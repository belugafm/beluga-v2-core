import { Options } from "../string"
import { PropertyValidator } from "../../PropertyValidator"
import { checkIsString } from "../../validator/string/isString"
import { checkMaxLength } from "../../validator/string/maxLength"
import { checkMinLength } from "../../validator/string/minLength"
import { checkRegexPattern } from "../../validator/string/regex"
import config from "../../../../config/app"

export function description() {
    const options: Options = {
        minLength: config.channel_group.description.min_length,
        maxLength: config.channel_group.description.max_length,
    }
    return new PropertyValidator<string>(options, [checkIsString, checkMinLength, checkMaxLength, checkRegexPattern])
}
