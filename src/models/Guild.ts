import { model, Schema, Types } from "mongoose";

interface IWebhook {
  channelId: string;

  id: string;
  token: string;

  components: string;
  lastSentId?: string;
}

interface IGuild {
  id: string;

  webhooks: Types.Array<IWebhook>;
}

const WebhookSchema = new Schema<IWebhook>({
  channelId: { type: String, required: true },

  id: { type: String, required: true },
  token: { type: String, required: true },

  lastSentId: { type: String, required: false },
  components: { type: String, required: false }
});

const GuildSchema = new Schema<IGuild>({
  id: { type: String, required: true, unique: true },

  webhooks: {
    type: [WebhookSchema],
    required: true,
    default: []
  }
});

const Guild = model<IGuild>("Guild", GuildSchema);

export { Guild, GuildSchema, IGuild };
