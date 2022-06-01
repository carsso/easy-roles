import { EmbedBuilder, ISlashCommand, MessageBuilder, SlashCommandBuilder, SlashCommandContext } from "interactions.ts";

export class About implements ISlashCommand {
  public builder = new SlashCommandBuilder("about", "Some information about the bot.");

  public handler = async (ctx: SlashCommandContext): Promise<void> => {
    return ctx.reply(
      new MessageBuilder(
        new EmbedBuilder(
          "About The Bot",
          `
          <@976236745655980072> provides an easy way to create and manage Self-Role buttons. These buttons are each tied to a role, which will be granted to any user who clicks the button. (Or removes the role, if you already have it.)

          Create a menu using \`\`/create-menu\`\`, then use the interactive menu under:

          Hold/Right Click on Message -> Apps -> Manage Role Buttons

          If you'd like to stick to commands, you can also use \`\`/create-role-button\`\` to create a button on the most recent menu in the channel.

          You can invite it by clicking on its profile, or by clicking the link below. After that, use \`\`/create-menu\`\` and enjoy!
          
          [ToS](https://rocksolidrobots.net/terms-of-service) | [Privacy Policy](https://rocksolidrobots.net/privacy-policy) | [Discord Support](https://rocksolidrobots.net/discord) | [Invite The Bot](https://rocksolidrobots.net/easy-roles) | [Vote For Us!](https://top.gg/bot/976236745655980072/vote)`
        ).setFooter({
          text: `This bot is a part of the RockSolidRobots network, find more from us at rocksolidrobots.net`
        })
      )
    );
  };
}
