import * as vs from "../../../../../domain/validation"

import {
    AuthenticityTokenQueryRepository,
    LoginSessionsQueryRepository,
    UsersQueryRepository,
} from "../../../../repositories"
import { InternalErrorSpec, UnexpectedErrorSpec, raise } from "../../../error"
import { MethodFacts, defineArguments, defineErrors, defineMethod } from "../../../define"

import { ApplicationError } from "../../../../../application/ApplicationError"
import { AuthenticityTokenEntity } from "../../../../../domain/entity/AuthenticityToken"
import { ContentTypes } from "../../../facts/content_type"
import { CookieAuthenticationApplication } from "../../../../../application/authentication/Cookie"
import { HttpMethods } from "../../../facts/http_method"
import { MethodIdentifiers } from "../../../identifier"
import { UserEntity } from "../../../../../domain/entity/User"

export const argumentSpecs = defineArguments(["session_id"] as const, {
    session_id: {
        description: ["セッションID"],
        examples: ["XXXXXXXXXX-XXXXXXXXXXXXX"],
        required: true,
        validator: vs.sessionId(),
    },
})

export const expectedErrorSpecs = defineErrors(
    ["session_not_found", "internal_error", "unexpected_error"] as const,
    argumentSpecs,
    {
        session_not_found: {
            description: ["セッションが見つかりません"],
            hint: [],
            argument: "session_id",
            code: "session_not_found",
        },
        internal_error: new InternalErrorSpec(),
        unexpected_error: new UnexpectedErrorSpec(),
    }
)

export const facts: MethodFacts = {
    url: MethodIdentifiers.AuthenticateUserWithCookie,
    httpMethod: HttpMethods.POST,
    rateLimiting: {},
    acceptedContentTypes: [ContentTypes.ApplicationJson],
    authenticationRequired: false,
    private: false,
    acceptedAuthenticationMethods: [],
    acceptedScopes: {},
    description: [],
}

export default defineMethod(
    facts,
    argumentSpecs,
    expectedErrorSpecs,
    async (args, errors): Promise<[UserEntity | null, AuthenticityTokenEntity | null]> => {
        try {
            const [user, _, authenticityToken] = await new CookieAuthenticationApplication(
                new UsersQueryRepository(),
                new LoginSessionsQueryRepository(),
                new AuthenticityTokenQueryRepository()
            ).authenticate({ sessionId: args.session_id })
            return [user, authenticityToken]
        } catch (error) {
            if (error instanceof ApplicationError) {
                raise(errors["internal_error"], error)
            } else if (error instanceof Error) {
                raise(errors["unexpected_error"], error)
            } else {
                raise(errors["unexpected_error"], new Error("unexpected_error"))
            }
        }
        return [null, null]
    }
)
