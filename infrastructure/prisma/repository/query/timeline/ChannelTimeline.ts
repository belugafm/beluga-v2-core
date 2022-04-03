import {
    IChannelTimelineQueryRepository,
    Parameters,
    SortOrder,
} from "../../../../../domain/repository/query/timeline/ChannelTimeline"
import { Message, PrismaClient } from "@prisma/client"
import { RepositoryError, UnknownRepositoryError } from "../../../../../domain/repository/RepositoryError"

import { MessageEntity } from "../../../../../domain/entity/Message"
import { isInteger } from "../../../../../domain/validation"
import { prisma } from "../../client"

function toEntity(message: Message) {
    return new MessageEntity({
        id: message.id,
        channelId: message.channelId,
        userId: message.userId,
        text: message.text,
        createdAt: message.createdAt,
        favoriteCount: message.favoriteCount,
        likeCount: message.likeCount,
        replyCount: message.replyCount,
        threadId: message.threadId,
    })
}

function toEntityList(messages: Message[]) {
    const ret: MessageEntity[] = []
    messages.forEach((message) => {
        ret.push(toEntity(message))
    })
    return ret
}

function getSortOrder(sortOrderString: keyof typeof SortOrder) {
    if (sortOrderString == "Descending") {
        return "desc"
    }
    if (sortOrderString == "Ascending") {
        return "asc"
    }
    throw new RepositoryError("invalid `sortOrder`")
}

export class ChannelTimelineQueryRepository implements IChannelTimelineQueryRepository {
    private _prisma: PrismaClient
    constructor(transaction?: PrismaClient) {
        if (transaction) {
            this._prisma = transaction
        } else {
            this._prisma = prisma
        }
    }
    async listMessage(params: { channelId: number } & Parameters): Promise<MessageEntity[]> {
        try {
            if (isInteger(params.channelId) !== true) {
                throw new RepositoryError("`channelId` must be a number")
            }
            if (params.sinceId) {
                if (isInteger(params.sinceId) !== true) {
                    throw new RepositoryError("`sinceId` must be a number")
                }
                const messages = await this._prisma.message.findMany({
                    where: {
                        channelId: params.channelId,
                        threadId: null,
                        id: {
                            gt: params.sinceId,
                        },
                    },
                    orderBy: {
                        createdAt: getSortOrder(params.sortOrder),
                    },
                    take: params.limit,
                })
                return toEntityList(messages)
            } else if (params.maxId) {
                if (isInteger(params.maxId) !== true) {
                    throw new RepositoryError("`maxId` must be a number")
                }
                const messages = await this._prisma.message.findMany({
                    where: {
                        channelId: params.channelId,
                        threadId: null,
                        id: {
                            lt: params.maxId,
                        },
                    },
                    orderBy: {
                        createdAt: getSortOrder(params.sortOrder),
                    },
                    take: params.limit,
                })
                return toEntityList(messages)
            } else {
                const messages = await this._prisma.message.findMany({
                    where: {
                        channelId: params.channelId,
                        threadId: null,
                    },
                    orderBy: {
                        createdAt: getSortOrder(params.sortOrder),
                    },
                    take: params.limit,
                })
                return toEntityList(messages)
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new RepositoryError(error.message, error.stack)
            } else {
                throw new UnknownRepositoryError()
            }
        }
    }
}
