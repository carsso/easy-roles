import {
  ActionRowBuilder,
  Button,
  ButtonBuilder,
  ButtonContext,
  ButtonStyle,
  EmbedBuilder,
  IUserCommand,
  MessageBuilder,
  UserCommandBuilder,
  UserCommandContext
} from "interactions.ts";

export default class Avatar implements IUserCommand {
  public builder = new UserCommandBuilder("Avatar");

  public handler = async (ctx: UserCommandContext): Promise<void> => {
    let server = false;

    const userId = ctx.target.user.id;
    const guildId = ctx.interaction.guild_id;

    let name = ctx.target.user.username;
    let avatar = ctx.target.user.avatar ?? "";

    if (ctx.target.member) {
      if (ctx.target.member.nick) {
        name = ctx.target.member.nick;
      }

      if (ctx.target.member.avatar) {
        avatar = ctx.target.member.avatar;
        server = true;
      }
    }

    const actionRow = new ActionRowBuilder([
      await ctx.createComponent("user", {
        name: ctx.target.user.username.length > 15 ? name.substring(0, 15) + "..." : name,
        userId: userId,
        avatar: ctx.target.user.avatar
      })
    ]);

    let guildAvatarButton;

    if (server) {
      guildAvatarButton = await ctx.createComponent("guild", {
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        userId: userId,
        avatar: avatar,
        guildId: guildId
      });
    } else {
      guildAvatarButton = await ctx.createComponent("guild");

      guildAvatarButton.setDisabled(true);
    }

    actionRow.addComponents(guildAvatarButton);

    return ctx.reply(
      (await buildAvatarEmbed(name, userId, avatar, server ? guildId : undefined)).addComponents(actionRow)
    );
  };

  public components = [
    new Button(
      "user",
      new ButtonBuilder().setLabel("Show User Avatar").setStyle(ButtonStyle.Primary),
      async (ctx: ButtonContext<{ name: string; userId: string; avatar: string }>) => {
        if (!ctx.state) return ctx.reply("Avatar unavailable.");

        const message = await buildAvatarEmbed(ctx.state.name, ctx.state.userId, ctx.state.avatar);

        return ctx.reply(message);
      }
    ),
    new Button(
      "guild",
      new ButtonBuilder().setLabel("Show Server Avatar").setStyle(ButtonStyle.Primary),
      async (ctx: ButtonContext<{ name: string; userId: string; avatar: string }>) => {
        if (!ctx.state) return ctx.reply("Menu unavailable.");

        const message = await buildAvatarEmbed(
          ctx.state.name,
          ctx.state.userId,
          ctx.state.avatar,
          ctx.interaction.guild_id
        );

        return ctx.reply(message);
      }
    )
  ];
}

async function buildAvatarEmbed(
  name: string,
  userId: string,
  avatar: string,
  guildId?: string
): Promise<MessageBuilder> {
  return new MessageBuilder(
    new EmbedBuilder()
      .setTitle(`${name}'s${guildId !== undefined ? " Server" : ""} Avatar`)
      .setImage(
        guildId !== undefined
          ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${avatar}${
              avatar.startsWith("a_") ? ".gif" : ".png"
            }`
          : `https://cdn.discordapp.com/avatars/${userId}/${avatar}${avatar.startsWith("a_") ? ".gif" : ".png"}`
      )
  );
}
