export function is_string(value: any) {
    return typeof value === "string"
}

export function is_number(value: any) {
    return typeof value === "number"
}

export function isDate(value: any) {
    return value instanceof Date
}
