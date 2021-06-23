import Router from "find-my-way"
import turbo from "turbo-http"
import { Request, Response, read_body } from "./turbo"
import qs from "qs"
import {
    WebApiRuntimeError,
    FraudPreventionAccessDeniedErrorSpec,
    InvalidContentTypeErrorSpec,
} from "../api/error"
import config from "../../config/app"
import * as fraud_prevention from "../../model/fraud_score/ok"
import { MethodFacts } from "../api/define"
import { ContentTypesLiteralUnion } from "../api/facts/content_type"
import { UserSchema } from "../../schema/user"
import { authenticate_user } from "../auth"
import { update_last_activity_date } from "../../model/user/update_last_activity_date"

export { Request, Response }

const DefaultRoute = (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json")
    res.setStatusCode(404)
    res.write(
        Buffer.from(
            JSON.stringify({
                ok: false,
                error: "endpoint_not_found",
            })
        )
    )
    res.end()
}

const AccessDeniedRoute = (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json")
    res.setStatusCode(403)
    res.write(
        Buffer.from(
            JSON.stringify({
                ok: false,
                error: "access_denied",
            })
        )
    )
    res.end()
}

declare module "find-my-way" {
    type Handler = (
        req: Request,
        res: Response,
        params: { ip_address: string; auth_user: UserSchema | null },
        store?: any
    ) => object | string
    type HTTPMethod = "GET" | "POST"
    interface Config {
        ignoreTrailingSlash?: boolean
        allowUnsafeRegex?: boolean
        caseSensitive?: boolean
        maxParamLength?: number
        defaultRoute?(req: Request, res: Response): void
        onBadUrl?(path: string, req: Request, res: Response): void
        versioning?: {
            storage(): {
                get(version: String): Handler | null
                set(version: String, store: Handler): void
                del(version: String): void
                empty(): void
            }
            deriveVersion(req: Request, ctx?: any): String
        }
    }
    interface ShortHandRoute {
        (path: string, handler: Handler): void
        (path: string, handler: Handler, store: any): void
    }
    interface Instance {
        on(
            method: HTTPMethod | HTTPMethod[],
            path: string,
            handler: Handler
        ): void
        lookup(req: Request, res: Response, ctx?: any): void
        get: ShortHandRoute
        post: ShortHandRoute
        routes: string[]
    }
}

export const ContentType = {
    HTML: "text/html",
    JSON: "application/json",
}

async function activate_user(user: UserSchema) {
    if (user.dormant === true) {
        return
    }
    if (user.active === true) {
        return
    }
    user.active = true
    await user.save()
}

const base_url = "/api/v1/"

type Options = {
    fraud_prevention_rule?: fraud_prevention.FraudPreventionRule
}

export class TurboServer {
    router: Router.Instance
    server: turbo.Server
    constructor(opt: Router.Config) {
        if (opt.defaultRoute == null) {
            opt.defaultRoute = DefaultRoute
        }
        this.router = Router(opt)
        this.server = turbo.createServer(async (_req, _res) => {
            // アクセスがあるたびここを通る
            const req = new Request(_req)
            const res = new Response(_res)
            const { host } = req.headers
            if (host !== config.server.domain) {
                return AccessDeniedRoute(req, res)
            }
            return this.router.lookup(req, res)
        })
    }
    get(facts: MethodFacts, handler: Router.Handler, options: Options = {}) {
        if (facts.http_method !== "GET") {
            throw new Error(
                "POSTリクエストが要求されているendpointをGETに登録することはできません"
            )
        }
        this.router.get(base_url + facts.url, async (req, res, params) => {
            res.setHeader("Content-Type", ContentType.JSON)
            try {
                const query = qs.parse(req.url.replace(/^.+\?/, ""), {
                    decoder: decodeURIComponent,
                })
                req.query = query

                if (facts.authentication_required) {
                    // ユーザー認証をここで行う
                    const auth_user = await authenticate_user(
                        facts,
                        req.query,
                        req.cookies
                    )
                    params["auth_user"] = auth_user
                }
                const data = await handler(req, res, params)
                res.write(Buffer.from(JSON.stringify(data)))
            } catch (error) {
                if (error instanceof WebApiRuntimeError) {
                    res.write(
                        Buffer.from(
                            JSON.stringify({
                                ok: false,
                                error_code: error.code,
                                description: error.description,
                                argument: error.argument,
                                hint: error.hint,
                                additional_message: error.additional_message,
                                stack: null,
                            })
                        )
                    )
                } else {
                    res.write(
                        Buffer.from(
                            JSON.stringify({
                                ok: false,
                                error_code: "unexpected_error",
                                description: [error.toString()],
                                stack: error.stack.split("\n"),
                            })
                        )
                    )
                }
            }
            res.end()
        })
    }
    post(facts: MethodFacts, handler: Router.Handler, options: Options = {}) {
        if (facts.http_method !== "POST") {
            throw new Error(
                "GETリクエストが要求されているendpointをPOSTに登録することはできません"
            )
        }
        this.router.post(base_url + facts.url, async (req, res, params) => {
            res.setHeader("Content-Type", ContentType.JSON)
            res.setStatusCode(200)
            try {
                const body = await read_body(req) // これは必ず一番最初に呼ぶ

                const content_type = req.headers["content-type"].split(
                    ";"
                )[0] as ContentTypesLiteralUnion
                if (
                    facts.accepted_content_types.includes(content_type) !== true
                ) {
                    throw new WebApiRuntimeError(
                        new InvalidContentTypeErrorSpec()
                    )
                }

                if (facts.authentication_required) {
                    // ユーザー認証をここで行う
                    const auth_user = await authenticate_user(
                        facts,
                        req.body,
                        req.cookies
                    )
                    if (auth_user) {
                        // activeなユーザーにする
                        await activate_user(auth_user)
                        await update_last_activity_date({
                            user_id: auth_user._id,
                            date: new Date(),
                        })
                    }
                    params["auth_user"] = auth_user
                }

                // IPアドレス等を使ってアクセス制限をする場合はここで行う
                const ip_address = req.headers["x-real-ip"]
                params["ip_address"] = ip_address
                if (config.fraud_prevention.enabled) {
                    const rule = options.fraud_prevention_rule
                        ? options.fraud_prevention_rule
                        : fraud_prevention.DefaultRule
                    if (
                        (await fraud_prevention.ok({
                            ip_address,
                            apply_rule: rule,
                        })) !== true
                    ) {
                        throw new WebApiRuntimeError(
                            new FraudPreventionAccessDeniedErrorSpec()
                        )
                    }
                }

                req.body = body
                const data = await handler(req, res, params)
                if (typeof data !== "object") {
                    throw new Error("handlerはオブジェクトを返す必要があります")
                }
                res.write(Buffer.from(JSON.stringify(data)))
            } catch (error) {
                if (error instanceof WebApiRuntimeError) {
                    res.write(
                        Buffer.from(
                            JSON.stringify({
                                ok: false,
                                error_code: error.code,
                                description: error.description,
                                argument: error.argument,
                                hint: error.hint,
                                additional_message: error.additional_message,
                                stack: null,
                            })
                        )
                    )
                } else {
                    res.write(
                        Buffer.from(
                            JSON.stringify({
                                ok: false,
                                error_code: "unexpected_error",
                                description: [error.toString()],
                                stack: error.stack.split("\n"),
                            })
                        )
                    )
                }
            }
            res.end()
        })
    }
    register(module: any) {
        module.default(this)
        return this
    }
    listen(port: number) {
        this.server.listen(port)
    }
}
