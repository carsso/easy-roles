import { model, Schema, Types } from "mongoose";

interface IMessage {
  id: string;

  components: string;
}

interface IWebhook {
  channelId: string;

  id: string;
  token: string;

  latestMessage: string;
  messages: Types.Map<IMessage>;
}

interface IGuild {
  id: string;

  webhooks: Types.Map<IWebhook>;
}

const MessageSchema = new Schema<IMessage>({
  id: { type: String, required: true },

  components: { type: String, required: true, default: "[]" }
});

const WebhookSchema = new Schema<IWebhook>({
  channelId: { type: String, required: true },

  id: { type: String, required: true },
  token: { type: String, required: true },

  latestMessage: { type: String, required: true, default: "" },
  messages: {
    type: Map,
    required: true,
    of: MessageSchema
  }
});

const GuildSchema = new Schema<IGuild>({
  id: { type: String, required: true, unique: true, index: true },

  webhooks: {
    type: Map,
    required: true,
    of: WebhookSchema
  }
});

const Message = model<IMessage>("Message", MessageSchema);
const Webhook = model<IWebhook>("Webhook", WebhookSchema);
const Guild = model<IGuild>("Guild", GuildSchema);

export { Guild, GuildSchema, IGuild, Webhook, IWebhook, WebhookSchema, Message, IMessage, MessageSchema };
