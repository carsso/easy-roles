import {
  APIActionRowComponent,
  APIMessageActionRowComponent,
  APIRole,
  RESTGetAPIGuildRolesResult
} from "discord-api-types/v10";
import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  ButtonStyle,
  EmbedBuilder,
  InteractionWebhook,
  MessageBuilder,
  Modal,
  ModalBuilder,
  ModalSubmitContext,
  SelectMenu,
  SelectMenuBuilder,
  SelectMenuContext,
  SelectMenuOptionBuilder,
  SimpleEmbed,
  SimpleError,
  TextInputBuilder,
  TextInputStyle
} from "interactions.ts";
import { Types } from "mongoose";
import { Secret } from "../../models/Secrets";

type State1 = {
  parentId: string;
};

type State2 = {
  parentId: string;

  colour: ButtonStyle;

  label: string | null;
  emoji: string | null;

  secret: string | null;

  page: number;
};

const StartCreateRoleButton = new Button(
  "createRoleButton",
  new ButtonBuilder(ButtonStyle.Primary, "Create Role Button"),
  async (ctx: ButtonContext<State1>) => {
    if (!ctx.state) return;
    const modal = await ctx.createComponent<ModalBuilder>("defineRoleButton", { parentId: ctx.state.parentId });

    return ctx.reply(modal);
  }
);

const DefineRoleButton = new Modal(
  "defineRoleButton",
  new ModalBuilder()
    .addComponents(
      new ActionRowBuilder([
        new TextInputBuilder("colour", "Button Colour", TextInputStyle.Short)
          .setPlaceholder('This must be one of "Blue", "Grey", "Green" or "Red". Defaults to Blue.')
          .setRequired(false)
          .setMinLength(3)
          .setMaxLength(5)
      ]),
      new ActionRowBuilder([
        new TextInputBuilder("label", "Button Label", TextInputStyle.Short)
          .setPlaceholder("A label for the button. You must set either this or an emoji for your button to be valid.")
          .setRequired(false)
          .setMaxLength(80)
      ]),
      new ActionRowBuilder([
        new TextInputBuilder("emoji", "Button Emoji", TextInputStyle.Short)
          .setPlaceholder("This must be a unicode emoji - Custom ones are not yet supported.")
          .setRequired(false)
          .setMaxLength(8)
      ]),
      new ActionRowBuilder([
        new TextInputBuilder("secret", "Secret", TextInputStyle.Short)
          .setPlaceholder("An optional secret key that users must also enter before being granted the role.")
          .setRequired(false)
      ])
    )
    .setTitle("Label your new button"),
  async (ctx: ModalSubmitContext<State1>) => {
    if (!ctx.state) return ctx.reply(SimpleError("Expired."));

    if (!ctx.components.has("label") && !ctx.components.has("emoji")) {
      return ctx.reply(SimpleError("You must set either a label or an emoji for your button.").setEphemeral(true));
    }

    let colour = ButtonStyle.Primary;

    if (ctx.components.has("colour")) {
      switch (ctx.components.get("colour")?.value.toLowerCase()) {
        case "blue":
          colour = ButtonStyle.Primary;
          break;
        case "green":
          colour = ButtonStyle.Success;
          break;
        case "red":
          colour = ButtonStyle.Danger;
          break;
        case "grey":
          colour = ButtonStyle.Secondary;
          break;
        default:
          return ctx.reply(SimpleError("Invalid colour.").setEphemeral(true));
      }
    }

    if (!ctx.components.has("label") && !ctx.components.has("emoji")) {
      return ctx.reply(SimpleError("You must set either a label or an emoji for your button.").setEphemeral(true));
    }

    const label = ctx.components.has("label") ? ctx.components.get("label")!.value.trim() : null;
    const emoji = ctx.components.has("emoji") ? ctx.components.get("emoji")!.value.trim() : null;

    const data = {
      parentId: ctx.state.parentId,

      colour,

      label: label,
      emoji: emoji,

      secret: ctx.components.get("secret")?.value ?? null,

      page: 1
    };

    const roleMenu = await ctx.createComponent<SelectMenuBuilder>("selectRoleButton", data);

    let roles: APIRole[];

    try {
      roles = (await ctx.manager.rest.get(`/guilds/${ctx.interaction.guild_id}/roles`)) as RESTGetAPIGuildRolesResult;
      roles.sort((a, b) => b.position - a.position);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      switch (err.code as number) {
        default: {
          console.error(err);
          await ctx.reply(SimpleError("An unknown error occurred.").setEphemeral(true));
          break;
        }
      }

      return;
    }

    if (roles.length === 0) {
      return ctx.reply(SimpleError("There are no roles in this server.").setEphemeral(true));
    }

    for (let i = 0; i < Math.min(roles.length, 25); i++) {
      const role = roles[i];

      roleMenu.addOptions(new SelectMenuOptionBuilder().setLabel(role.name.substring(0, 44)).setValue(role.id));
    }

    const message = new MessageBuilder(new EmbedBuilder("Please Select A Role"))
      .addComponents(new ActionRowBuilder([roleMenu]))
      .setEphemeral(true);

    const pageRow = new ActionRowBuilder();

    const back = (await ctx.createComponent("selectRolePrevPage", data)).setDisabled(true);
    const next = (await ctx.createComponent("selectRoleNextPage", data)).setDisabled(true);

    const search = await ctx.createComponent("searchRole", data);

    if (roles.length >= 25) {
      next.setDisabled(false);
    }

    pageRow.addComponents(back, next, search);
    message.addComponents(pageRow);

    await ctx.reply(message);
  }
);

const SelectRole = new SelectMenu(
  "selectRoleButton",
  new SelectMenuBuilder().setMaxValues(1),
  async (ctx: SelectMenuContext<State2>) => {
    if (!ctx.state) return;

    if (!ctx.webhook) {
      return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
    }

    await updateRoleButtonMenu(ctx);
  }
);

const RoleListBackPage = new Button(
  "selectRolePrevPage",
  new ButtonBuilder(ButtonStyle.Secondary).setEmoji({ name: "◀️" }),
  async (ctx: ButtonContext<State2>) => {
    if (!ctx.state) return ctx.reply(SimpleError("Expired."));

    ctx.state.page -= 1;

    const roleMenu = await ctx.createComponent<SelectMenuBuilder>("selectRoleButton", ctx.state);

    let roles: APIRole[];

    try {
      roles = (await ctx.manager.rest.get(`/guilds/${ctx.interaction.guild_id}/roles`)) as RESTGetAPIGuildRolesResult;
      roles.sort((a, b) => b.position - a.position);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      switch (err.code as number) {
        default: {
          console.error(err);
          await ctx.reply(SimpleError("An unknown error occurred."));
          break;
        }
      }

      return;
    }

    if (roles.length === 0) {
      return ctx.reply(SimpleError("There are no roles on this page."));
    }

    for (let i = (ctx.state.page - 1) * 25; i < Math.min(roles.length, ctx.state.page * 25); i++) {
      const role = roles[i];

      roleMenu.addOptions(new SelectMenuOptionBuilder().setLabel(role.name.substring(0, 44)).setValue(role.id));
    }

    const message = new MessageBuilder(new EmbedBuilder("Please Select A Role")).addComponents(
      new ActionRowBuilder([roleMenu])
    );

    const pageRow = new ActionRowBuilder();

    const back = await ctx.createComponent("selectRolePrevPage", ctx.state);
    const next = await ctx.createComponent("selectRoleNextPage", ctx.state);

    const search = await ctx.createComponent("searchRole", ctx.state);

    if (ctx.state.page === 1) {
      back.setDisabled(true);
    }

    if (ctx.state.page * 25 <= roles.length) {
      next.setDisabled(true);
    }

    pageRow.addComponents(back, next, search);
    message.addComponents(pageRow);

    await ctx.reply(message);
  }
);

const RoleListNextPage = new Button(
  "selectRoleNextPage",
  new ButtonBuilder(ButtonStyle.Secondary).setEmoji({ name: "▶️" }),
  async (ctx: ButtonContext<State2>) => {
    if (!ctx.state) return ctx.reply(SimpleError("Expired."));

    ctx.state.page += 1;

    const roleMenu = await ctx.createComponent<SelectMenuBuilder>("selectRoleButton", ctx.state);

    let roles: APIRole[];

    try {
      roles = (await ctx.manager.rest.get(`/guilds/${ctx.interaction.guild_id}/roles`)) as RESTGetAPIGuildRolesResult;
      roles.sort((a, b) => b.position - a.position);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      switch (err.code as number) {
        default: {
          console.error(err);
          await ctx.reply(SimpleError("An unknown error occurred."));
          break;
        }
      }

      return;
    }

    if (roles.length === 0) {
      return ctx.reply(SimpleError("There are no roles on this page."));
    }

    for (let i = (ctx.state.page - 1) * 25; i < Math.min(roles.length, ctx.state.page * 25); i++) {
      const role = roles[i];

      roleMenu.addOptions(new SelectMenuOptionBuilder().setLabel(role.name.substring(0, 44)).setValue(role.id));
    }

    const message = new MessageBuilder(new EmbedBuilder("Please Select A Role")).addComponents(
      new ActionRowBuilder([roleMenu])
    );

    const pageRow = new ActionRowBuilder();

    const back = await ctx.createComponent("selectRolePrevPage", ctx.state);
    const next = await ctx.createComponent("selectRoleNextPage", ctx.state);

    const search = await ctx.createComponent("searchRole", ctx.state);

    if (ctx.state.page === 1) {
      back.setDisabled(true);
    }

    if (ctx.state.page * 25 <= roles.length) {
      next.setDisabled(true);
    }

    pageRow.addComponents(back, next, search);
    message.addComponents(pageRow);

    await ctx.reply(message);
  }
);

const RoleListSearch = new Button(
  "searchRole",
  new ButtonBuilder(ButtonStyle.Secondary).setEmoji({ name: "🔍" }),
  async (ctx: ButtonContext<State2>) => {
    if (!ctx.state) return;
    const modal = await ctx.createComponent<ModalBuilder>("getRoleName", ctx.state);

    return ctx.reply(modal);
  }
);

const UpdateByNameOrId = new Modal(
  "getRoleName",
  new ModalBuilder()
    .addComponents(
      new ActionRowBuilder([new TextInputBuilder("role", "Role Name/ID", TextInputStyle.Short).setRequired(true)])
    )
    .setTitle("Search by Role Name/ID"),
  async (ctx: ModalSubmitContext<State2>) => {
    if (!ctx.state) return;

    if (!ctx.webhook) {
      return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
    }

    await updateRoleButtonMenu(ctx);
  }
);

async function updateRoleButtonMenu(ctx: SelectMenuContext<State2> | ModalSubmitContext<State2>) {
  if (!ctx.state) return;

  if (!ctx.webhook) {
    return ctx.reply(SimpleError("Webhook not found.").setEphemeral(true));
  }

  let roleId: string;

  if (ctx instanceof SelectMenuContext) {
    roleId = ctx.values[0];
  } else {
    let roles;

    try {
      roles = (await ctx.manager.rest.get(`/guilds/${ctx.interaction.guild_id}/roles`)) as RESTGetAPIGuildRolesResult;
      roles.sort((a, b) => b.position - a.position);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      switch (err.code as number) {
        default: {
          console.error(err);
          await ctx.reply(SimpleError("An unknown error occurred."));
          break;
        }
      }

      return;
    }

    const input = ctx.components.get("role")!.value;

    let value;
    if (/^[0-9]+$/.test(input)) {
      value = roles.find((role) => role.id === input)?.id;
    } else {
      value = roles.find((role) => role.name === input)?.id;
      if (!value) value = roles.find((role) => role.name.toLowerCase() === input.toLowerCase())?.id;
    }

    if (!value) {
      return ctx.reply(SimpleError("Role not found.").setEphemeral(true).setComponents([]));
    }

    roleId = value;
  }

  const webhook = new InteractionWebhook(ctx.webhook.id, ctx.webhook.token);

  const message = ctx.webhook.messages.get(ctx.state.parentId);

  if (!message) {
    return ctx.reply(SimpleError("Message not found.").setEphemeral(true).setComponents([]));
  }

  const components: APIActionRowComponent<APIMessageActionRowComponent>[] = message.components
    ? JSON.parse(message.components)
    : [];

  async function getButton(id: number): Promise<ButtonBuilder> {
    if (!ctx.state) throw new Error("No state");

    let secretId = null;

    if (ctx.state.secret) {
      const secret = await new Secret({ text: ctx.state.secret }).save();
      secretId = secret._id;
    }

    const data: { roleId: string; id: number; secretId?: Types.ObjectId } = {
      roleId,
      id
    };

    if (secretId) data.secretId = secretId;

    const button = await ctx.createGlobalComponent<ButtonBuilder>("addRole", data);

    button.setStyle(ctx.state.colour);

    if (ctx.state?.label !== null) {
      button.setLabel(ctx.state.label);
    }

    if (
      ctx.state?.emoji !== null &&
      /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi.test(
        ctx.state.emoji
      )
    ) {
      button.setEmoji({ name: ctx.state.emoji });
    }

    return button;
  }

  let pushed = false;
  let componentCount = 0;

  let button: ButtonBuilder;

  for (const actionRow of components) {
    componentCount += actionRow.components.length;

    if (actionRow.components.length < 5) {
      button = await getButton(componentCount);

      actionRow.components.push(button.toJSON());

      pushed = true;
    }
  }

  if (!pushed) {
    button = await getButton(componentCount);

    components.push(new ActionRowBuilder([button]).toJSON());
  }

  try {
    await webhook.edit(new MessageBuilder({ components }), message.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    switch (err.code as number) {
      case 10008: {
        await ctx.reply(
          SimpleError(
            `I can't find this message, please ensure it hasn't been deleted and that the bot has access to view the channel.`
          )
            .setEphemeral(true)
            .setComponents([])
        );
        break;
      }
      default: {
        console.error(err);
        await ctx.reply(
          SimpleError("An unknown error occurred while adding your button.").setEphemeral(true).setComponents([])
        );
        break;
      }
    }

    return;
  }

  const messageDoc = ctx.db.webhooks.get(ctx.webhook.channelId)?.messages.get(message.id);
  if (messageDoc) messageDoc.components = JSON.stringify(components);

  ctx.db.markModified("webhooks");
  await ctx.db.save();

  return ctx.reply(SimpleEmbed("Role Button Added").setComponents([]).setEphemeral(true));
}

export const CreateRoleButtonButtons = [
  StartCreateRoleButton,
  DefineRoleButton,
  SelectRole,
  RoleListBackPage,
  RoleListNextPage,
  RoleListSearch,
  UpdateByNameOrId
];
