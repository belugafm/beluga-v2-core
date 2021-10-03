import { LoginCredentialEntity } from "../../../../domain/entity/LoginCredential"
import { LoginCredentialsCommandRepository } from "../../../../infrastructure/mongodb/repository/command/LoginCredentials"
import { LoginCredentialsQueryRepository } from "../../../../infrastructure/mongodb/repository/query/LoginCredentials"
import { UserEntity } from "../../../../domain/entity/User"
import { UsersCommandRepository } from "../../../../infrastructure/mongodb/repository/command/Users"
import { db } from "../../../mongodb"

jest.setTimeout(30000)

describe("LoginCredentialsRepository", () => {
    beforeAll(async () => {
        await db.connect()
    })
    afterAll(async () => {
        await db.disconnect()
    })
    test("Normal", async () => {
        const usersCommandRepository = new UsersCommandRepository()
        const loginCredentialQueryRepository = new LoginCredentialsQueryRepository()
        const loginCredentialsCommandRepository = new LoginCredentialsCommandRepository()

        const user = new UserEntity({ id: -1, name: "hoge", registrationIpAddress: "192.168.1.1" })
        const userId = await usersCommandRepository.add(user)
        user.id = userId
        const loginCredential = await LoginCredentialEntity.new(userId, "password")
        await loginCredentialsCommandRepository.add(loginCredential)

        {
            const _credential = await loginCredentialQueryRepository.findByUserId(userId)
            expect(_credential).toBeInstanceOf(LoginCredentialEntity)
            expect(_credential?.userId).toBe(loginCredential.userId)
            expect(_credential?.passwordHash).toBe(loginCredential.passwordHash)
        }

        const newPassword = "new_password"
        const newLoginCredential = await LoginCredentialEntity.new(userId, newPassword)
        const success = await loginCredentialsCommandRepository.update(newLoginCredential)
        expect(success).toBeTruthy()

        const _credential = await loginCredentialQueryRepository.findByUserId(userId)
        expect(_credential).toBeInstanceOf(LoginCredentialEntity)
        expect(_credential?.userId).toBe(loginCredential.userId)
        expect(_credential?.passwordHash).toBe(newLoginCredential.passwordHash)

        const succeeded = await loginCredentialsCommandRepository.delete(newLoginCredential)
        expect(succeeded).toBeTruthy()

        {
            const _credential = await loginCredentialQueryRepository.findByUserId(userId)
            expect(_credential).toBeNull()
        }
    })
})
