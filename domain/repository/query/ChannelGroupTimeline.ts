import { ChannelGroupdId, MessageId } from "../../types"

export const SortOrder = {
    Ascending: "Ascending",
    Descending: "Descending",
} as const

export type Parameters = {
    sortOrder: keyof typeof SortOrder
    limit: number
    sinceId?: MessageId
    maxId?: MessageId
}

export interface IChannelGroupTimelineQueryRepository {
    listMessageId(params: { channelGroupId: ChannelGroupdId } & Parameters): Promise<MessageId[]>
}
