import { InternalErrorSpec, UnexpectedErrorSpec, raise } from "../../error"
import { MethodFacts, defineArguments, defineErrors, defineMethod } from "../../define"
import { GenerateAccessTokenApplication, ErrorCodes } from "../../../../application/oauth/GenerateAccessToken"
import {
    TransactionRepository,
    RequestTokenCommandRepository,
    ApplicationQueryRepository,
    RequestTokenQueryRepository,
    AccessTokenCommandRepository,
} from "../../../repositories"

import { ApplicationError } from "../../../../application/ApplicationError"
import { ContentTypes } from "../../facts/content_type"
import { HttpMethods } from "../../facts/http_method"
import { MethodIdentifiers } from "../../identifier"
import * as vs from "../../../../domain/validation"
import { AccessTokenEntity } from "../../../../domain/entity/AccessToken"
import { AuthenticationMethods } from "../../facts/authentication_method"

export const argumentSpecs = defineArguments(
    ["consumer_key", "consumer_secret", "request_token", "request_token_secret", "verifier"] as const,
    {
        consumer_key: {
            description: [""],
            examples: ["xxxxxx-xxxxxxx-xxxxxxx"],
            required: true,
            validator: vs.string({ minLength: 1, maxLength: 100 }),
        },
        consumer_secret: {
            description: [""],
            examples: ["xxxxxx-xxxxxxx-xxxxxxx"],
            required: true,
            validator: vs.string({ minLength: 1, maxLength: 100 }),
        },
        request_token: {
            description: [""],
            examples: ["xxxxxx-xxxxxxx-xxxxxxx"],
            required: true,
            validator: vs.string({ minLength: 1, maxLength: 100 }),
        },
        request_token_secret: {
            description: [""],
            examples: ["xxxxxx-xxxxxxx-xxxxxxx"],
            required: true,
            validator: vs.string({ minLength: 1, maxLength: 100 }),
        },
        verifier: {
            description: [""],
            examples: ["xxxxxx-xxxxxxx-xxxxxxx"],
            required: true,
            validator: vs.string({ minLength: 1, maxLength: 100 }),
        },
    }
)

export const expectedErrorSpecs = defineErrors(
    [
        ErrorCodes.InvalidConsumerKey,
        ErrorCodes.InvalidRequestToken,
        ErrorCodes.InvalidVerifier,
        "internal_error",
        "unexpected_error",
    ] as const,
    argumentSpecs,
    {
        invalid_consumer_key: {
            description: ["consumer_keyまたはconsumer_secretを正しく指定してください"],
            hint: [],
            code: "invalid_consumer_key",
            argument: "consumer_key",
        },
        invalid_request_token: {
            description: ["無効なリクエストトークンです"],
            hint: [],
            code: "invalid_request_token",
            argument: "request_token",
        },
        invalid_verifier: {
            description: ["無効なverifierです"],
            hint: [],
            code: "invalid_verifier",
            argument: "verifier",
        },
        internal_error: new InternalErrorSpec(),
        unexpected_error: new UnexpectedErrorSpec(),
    }
)

export const facts: MethodFacts = {
    url: MethodIdentifiers.GenerateAccessToken,
    httpMethod: HttpMethods.POST,
    rateLimiting: {},
    acceptedContentTypes: [ContentTypes.ApplicationJson],
    authenticationRequired: true,
    private: false,
    acceptedAuthenticationMethods: [AuthenticationMethods.Cookie],
    acceptedScopes: {},
    description: [],
}

type ReturnType = Promise<AccessTokenEntity>

export default defineMethod(facts, argumentSpecs, expectedErrorSpecs, async (args, errors, authUser): ReturnType => {
    if (authUser == null) {
        raise(errors["internal_error"])
    }
    const transaction = await TransactionRepository.new<ReturnType>()
    try {
        return await transaction.$transaction(async (transactionSession) => {
            return await new GenerateAccessTokenApplication(
                new AccessTokenCommandRepository(transactionSession),
                new RequestTokenQueryRepository(transactionSession),
                new RequestTokenCommandRepository(transactionSession),
                new ApplicationQueryRepository(transactionSession)
            ).generate({
                userId: authUser.id,
                consumerKey: args.consumer_key,
                consumerSecret: args.consumer_secret,
                requestToken: args.request_token,
                requestTokenSecret: args.request_token_secret,
                verifier: args.verifier,
            })
        })
    } catch (error) {
        console.error(error)
        if (error instanceof ApplicationError) {
            if (error.code === ErrorCodes.InvalidRequestToken) {
                raise(errors["invalid_request_token"], error)
            }
            raise(errors["internal_error"], error)
        } else if (error instanceof Error) {
            raise(errors["unexpected_error"], error)
        } else {
            raise(errors["unexpected_error"], new Error("unexpected_error"))
        }
    }
})
