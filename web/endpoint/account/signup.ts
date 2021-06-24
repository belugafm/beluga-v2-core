import { TurboServer } from "../../turbo"
import signup, { facts } from "../../api/methods/account/signup"
import signin from "../../api/methods/account/signin"
import { StrictRule } from "../../../model/fraud_score/ok"
import config from "../../../config/app"
import { InternalErrorSpec, WebApiRuntimeError } from "../../api/error"
import { invalidate_last_login_session } from "../../auth"

export default (server: TurboServer) => {
    server.post(
        facts,
        async (req, res, params) => {
            await signup({
                name: req.body.name,
                password: req.body.password,
                confirmed_password: req.body.confirmed_password,
                ip_address: params["ip_address"],
            })
            await invalidate_last_login_session(req.cookies)
            const [user, session] = await signin({
                name: req.body.name,
                password: req.body.password,
                ip_address: params["ip_address"],
                session_lifetime: config.user_registration.reclassify_inactive_as_dormant_after / 2,
            })
            if (session == null) {
                throw new WebApiRuntimeError(new InternalErrorSpec())
            }
            res.setCookie("user_id", session.user_id.toHexString(), {
                expires: session.expire_date,
                domain: config.server.domain,
                path: "/",
                httpOnly: true,
            })
            res.setCookie("session_id", session._id.toHexString(), {
                expires: session.expire_date,
                domain: config.server.domain,
                path: "/",
                httpOnly: true,
            })
            res.setCookie("session_token", session.session_token, {
                expires: session.expire_date,
                domain: config.server.domain,
                path: "/",
                httpOnly: true,
            })
            return {
                ok: true,
            }
        },
        {
            fraud_prevention_rule: StrictRule,
        }
    )
}
