import { ContentTypes } from "../../facts/content_type"
import { HttpMethods } from "../../facts/http_method"
import { MethodIdentifiers } from "../../identifier"
import {
    MethodFacts,
    define_method,
    define_arguments,
    define_expected_errors,
} from "../../define"
import * as vs from "../../../../domain/validation"
import { InternalErrorSpec, UnexpectedErrorSpec, raise } from "../../error"
import { ModelRuntimeError } from "../../../../domain/error"
import config from "../../../../config/app"
import { RegisterUserApplication } from "../../../../application/RegisterUser"
import {
    UsersRepository,
    UserRegistrationRepository,
} from "../../../repository"
import { UserModel } from "../../../../domain/model/User"

export const argument_specs = define_arguments(
    ["name", "password", "confirmed_password", "ip_address"] as const,
    {
        name: {
            description: ["ユーザー名"],
            examples: ["beluga"],
            required: true,
            schema: vs.user.name(),
        },
        password: {
            description: ["パスワード"],
            examples: null,
            required: true,
            schema: vs.password(),
        },
        confirmed_password: {
            description: ["確認用のパスワード"],
            examples: null,
            required: true,
            schema: vs.password(),
        },
        ip_address: {
            description: ["登録時のIPアドレス"],
            examples: null,
            required: true,
            schema: vs.ip_address(),
        },
    }
)

export const expected_error_specs = define_expected_errors(
    [
        "invalid_arg_name",
        "invalid_arg_password",
        "invalid_arg_confirmed_password",
        "invalid_arg_ip_address",
        "name_taken",
        "too_many_requests",
        "internal_error",
        "unexpected_error",
    ] as const,
    argument_specs,
    {
        invalid_arg_name: {
            description: ["ユーザー名が基準を満たしていません"],
            hint: [
                `ユーザー名は${config.user.name.min_length}〜${config.user.name.max_length}文字の半角英数字に設定してください`,
            ],
            argument: "name",
            code: "invalid_arg_name",
        },
        invalid_arg_password: {
            description: ["パスワードが基準を満たしていません"],
            argument: "password",
            code: "invalid_arg_password",
        },
        invalid_arg_confirmed_password: {
            description: ["確認用のパスワードが一致しません"],
            hint: ["パスワードと確認用パスワードは同じものを入力してください"],
            argument: "confirmed_password",
            code: "invalid_arg_confirmed_password",
        },
        invalid_arg_ip_address: {
            description: ["登録ユーザーのIPアドレスを正しく指定してください"],
            hint: [],
            argument: "ip_address",
            code: "invalid_arg_ip_address",
        },
        name_taken: {
            description: [
                "このユーザー名はすでに取得されているため、新規作成できません",
            ],
            hint: ["別のユーザー名でアカウントを作成してください"],
            code: "name_taken",
        },
        too_many_requests: {
            description: ["アカウントの連続作成はできません"],
            hint: ["しばらく時間をおいてから再度登録してください"],
            code: "too_many_requests",
        },
        internal_error: new InternalErrorSpec(),
        unexpected_error: new UnexpectedErrorSpec(),
    }
)

export const facts: MethodFacts = {
    url: MethodIdentifiers.CreateAccount,
    http_method: HttpMethods.POST,
    rate_limiting: {},
    accepted_content_types: [ContentTypes.ApplicationJson],
    authentication_required: false,
    accepted_authentication_methods: [],
    accepted_scopes: {},
    description: ["新規アカウントを作成します"],
}

export default define_method(
    facts,
    argument_specs,
    expected_error_specs,
    async (args, errors): Promise<UserModel | null> => {
        if (args.password !== args.confirmed_password) {
            raise(errors.invalid_arg_confirmed_password)
        }
        try {
            const usersRepository = new UsersRepository()
            const userRegistrationRepository = new UserRegistrationRepository()
            const app = new RegisterUserApplication(
                usersRepository,
                userRegistrationRepository
            )
            return await app.register({
                name: args.name,
                password: args.password,
                ipAddress: args.ip_address,
            })
        } catch (error) {
            if (error instanceof ModelRuntimeError) {
                if (error.code === ModelErrorCodes.NameTaken) {
                    raise(errors.name_taken, error)
                } else if (error.code === ModelErrorCodes.TooManyRequests) {
                    raise(errors.too_many_requests, error)
                } else {
                    raise(errors.internal_error, error)
                }
            } else {
                raise(errors.unexpected_error, error)
            }
        }
        return null
    }
)
