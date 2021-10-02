import { IUsersQueryRepository, SortBy, SortOrder } from "../repository/query/Users"

import { DomainError } from "../DomainError"
import config from "../../config/app"

export const ErrorCodes = {
    TooManyRequests: "too_many_requests",
} as const

export class CheckRegistrationRateLimitService {
    private usersRepository: IUsersQueryRepository
    constructor(usersRepository: IUsersQueryRepository) {
        this.usersRepository = usersRepository
    }
    async isRateLimited(ipAddress: string) {
        const existingUsers = await this.usersRepository.findByRegistrationIpAddress(
            ipAddress,
            SortBy.CreatedAt,
            SortOrder.Descending
        )
        if (existingUsers.length == 0) {
            return false
        }
        const user = existingUsers[0]
        const current = new Date()
        const seconds = (current.getTime() - user.createdAt.getTime()) / 1000
        if (seconds < config.user_registration.limit) {
            return true
        }
        return false
    }
    async tryCheckIfRateIsLimited(ipAddress: string) {
        if (await this.isRateLimited(ipAddress)) {
            throw new DomainError(ErrorCodes.TooManyRequests)
        }
    }
}
