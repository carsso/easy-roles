import { EmbedBuilder, ISlashCommand, MessageBuilder, SlashCommandBuilder, SlashCommandContext } from "interactions.ts";

export class About implements ISlashCommand {
  public builder = new SlashCommandBuilder("about", "Some information about the bot.");

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    return ctx.reply(
      new MessageBuilder(
        new EmbedBuilder(
          "About The Bot",
          `
          <@976236745655980072> is a utility bot offering functionality like old school reaction role bots, but with buttons.

          Create an embed, then add buttons to it that users can click on to quickly add/remove a role from themselves. 
          
          You can invite it by clicking on its profile, or by [clicking here :)](https://rocksolidrobots.com/toolbox) After that, use /create-embed and enjoy!`
        ).setFooter({
          text: `This bot is a part of the RockSolidRobots network, find more from us at rocksolidbots.net/invite.`
        })
      )
    );
  };
}
