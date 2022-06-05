import { Routes } from "discord-api-types/v10";
import "dotenv/config";
import fastify from "fastify";
import rawBody from "fastify-raw-body";
import {
  AutocompleteContext,
  Button,
  ButtonBuilder,
  ButtonContext,
  DiscordApplication,
  InteractionContext,
  InteractionHandlerTimedOut,
  ModalBuilder,
  PingContext,
  SimpleEmbed,
  SimpleError,
  UnauthorizedInteraction,
  UnknownApplicationCommandType,
  UnknownComponentType,
  UnknownInteractionType
} from "interactions.ts";
import { connect, HydratedDocument } from "mongoose";
import { createClient } from "redis";
import { About, Autorole, CreateMenu, CreateRoleButton, Help, ManageRoleButtons, Ping } from "./commands";
import { Guild, IGuild, IWebhook } from "./models/Guild";
const keys = ["CLIENT_ID", "TOKEN", "PUBLIC_KEY", "PORT"];

if (keys.some((key) => !(key in process.env))) {
  console.error(`Missing Enviroment Variables`);
  process.exit(1);
}

declare module "interactions.ts" {
  interface BaseInteractionContext {
    db: HydratedDocument<IGuild>;
    webhook: HydratedDocument<IWebhook> | undefined;
  }
}

type State = {
  roleId: string;
  secretId?: string;
};

(async () => {
  const redisClient = createClient({
    url: "redis://redis"
  });

  await redisClient.connect();

  const app = new DiscordApplication({
    clientId: process.env.CLIENT_ID as string,
    token: process.env.TOKEN as string,
    publicKey: process.env.PUBLIC_KEY as string,

    cache: {
      get: (key: string) => redisClient.get(key),
      set: (key: string, ttl: number, value: string) => redisClient.setEx(key, ttl, value)
    },

    hooks: {
      interaction: async (ctx: InteractionContext) => {
        if (ctx instanceof PingContext) return;
        if (!ctx.interaction.guild_id) return;

        let data;

        try {
          data = await Guild.findOne({ id: ctx.interaction.guild_id });

          if (data) {
            await data.populate("webhooks");
            await data.populate("webhooks.$*.messages");
          } else {
            data = new Guild({ id: ctx.interaction.guild_id, webhooks: new Map(), autoroleFailures: new Map() });
            await data.save();
          }
        } catch (err) {
          console.error(err);

          if (ctx instanceof AutocompleteContext) {
            await ctx.reply([]);
          } else {
            await ctx.reply(SimpleError("There was an error loading your game data"));
          }

          return true;
        }

        const webhook = ctx.interaction.channel_id ? data.webhooks.get(ctx.interaction.channel_id) : undefined;
        ctx.decorate("webhook", webhook);

        ctx.decorate("db", data);
      }
    }
  });

  app.components.register([
    new Button("addRole", new ButtonBuilder(), async (ctx: ButtonContext<State>) => {
      if (!ctx.state || !ctx.interaction.guild_id)
        return ctx.reply(SimpleError("Role ID not found.").setEphemeral(true));

      if (!ctx.interaction.member) return ctx.reply(SimpleError("Member not found.").setEphemeral(true));

      if (ctx.state.secretId) {
        return ctx.reply(
          await ctx.createGlobalComponent<ModalBuilder>("create-role-button.verifyRoleSecret", {
            secretId: ctx.state.secretId,
            roleId: ctx.state.roleId
          })
        );
      }

      await ctx.defer();

      let method: "delete" | "put" = "put";

      if (ctx.interaction.member.roles.find((id) => id === ctx.state?.roleId)) {
        method = "delete";
      }

      try {
        await ctx.manager.rest[method](
          Routes.guildMemberRole(ctx.interaction.guild_id, ctx.interaction.member.user.id, ctx.state.roleId)
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        switch (err.code as number) {
          case 50013: {
            await ctx.send(
              SimpleError(
                `I don't have permission to ${
                  method === "put" ? "assign" : "remove"
                } this role. Please check that I have the \`\`Manage Roles\`\` permission and that my role is above the one you're trying to toggle.`
              ).setEphemeral(true)
            );
            break;
          }
          case 50001: {
            await ctx.send(
              SimpleError(
                `I don't have permission to ${
                  method === "put" ? "assign" : "remove"
                } this role. Please check that I have the \`\`Manage Roles\`\` permission and that my role is above the one you're trying to toggle.`
              ).setEphemeral(true)
            );
            break;
          }
          default: {
            console.error(err);
            await ctx.send(SimpleError("An unknown error occurred.").setEphemeral(true));
            break;
          }
        }

        return;
      }

      await ctx.send(
        SimpleEmbed(
          `You ${method === "put" ? "now" : "no longer"} have the <@&${ctx.state.roleId}> role!`
        ).setEphemeral(true)
      );
    })
  ]);

  const avatar = (await app.commands.getAPICommands()).find((cmd) => cmd.name === "Avatar");

  await app.commands.register(
    [
      new Help(),
      new About(),
      new Ping(),
      new ManageRoleButtons(),
      new CreateMenu(),
      new CreateRoleButton(),
      new Autorole()
    ],
    false
  );

  const server = fastify();
  server.register(rawBody);

  server.post("/", async (request, reply) => {
    const signature = request.headers["x-signature-ed25519"];
    const timestamp = request.headers["x-signature-timestamp"];

    if (typeof request.rawBody !== "string" || typeof signature !== "string" || typeof timestamp !== "string") {
      return reply.code(400).send({
        error: "Invalid request"
      });
    }

    try {
      await app.handleInteraction(
        async (response) => {
          reply.code(200).send(response);
        },
        request.rawBody,
        timestamp,
        signature
      );
    } catch (err) {
      if (err instanceof UnauthorizedInteraction) {
        console.error("Unauthorized Interaction");
        return reply.code(401).send();
      }

      if (err instanceof InteractionHandlerTimedOut) {
        console.error("Interaction Handler Timed Out");

        return reply.code(408).send();
      }

      if (
        err instanceof UnknownInteractionType ||
        err instanceof UnknownApplicationCommandType ||
        err instanceof UnknownComponentType
      ) {
        console.error("Unknown Interaction - Library may be out of date.");
        console.dir(err.interaction);

        return reply.code(400).send();
      }

      console.error(err);
    }
  });

  server.post("/member-join", async (request, reply) => {
    const data = request.body as { guild_id: string; member_id: string };

    const guild = await Guild.findOne({ id: data.guild_id });

    if (!guild) {
      return reply.send();
    }

    for (const role of guild.autoroles) {
      try {
        await app.rest.put(Routes.guildMemberRole(data.guild_id, data.member_id, role));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        switch (err.code as number) {
          case 50013: {
            guild.autoroleFailures.set(role, (guild.autoroleFailures.get(role) ?? 0) + 1);

            if ((guild.autoroleFailures.get(role) as number) >= 3) {
              guild.autoroles.splice(guild.autoroles.indexOf(role), 1);
              guild.autoroleFailures.delete(role);
            }

            console.log("Removing autorole due to lack of permissions.");
            await guild.save();

            break;
          }
          default: {
            console.error(err);
            break;
          }
        }
      }
    }
  });

  await connect(`mongodb://mongo/easy-roles`);

  const address = "0.0.0.0";
  const port = process.env.PORT as string;

  server.listen(port, address);
  console.log(`Listening for interactions on ${address}:${port}.`);
})();
