import { ApplicationCommandOptionType } from 'discord.js';
import { UserType } from '@prisma/client';
import { Command } from '../../structures/Command';
import { sendSuccess } from '../../utils/messages';
import sendEmbed from '../../utils/messages/sendEmbed';
import { Colours } from '../../@types/Colours';
import { capitalize } from '../../utils/misc';
import logger from '../../utils/logger';
import db from '../../utils/database';
import actionAppeal from '../../utils/actioning/actionAppeal';

export default new Command({
    name: 'checkuser',
    description: 'See if a user is blacklisted',
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: 'user',
            description: 'User or ID',
            required: true,
        },
    ],
    run: async ({ interaction, client }) => {
        const id = interaction.options.getUser('user')?.id as string;

        const data = await db.getUser(id);
        if (!data || data.status === 'WHITELISTED')
            return sendSuccess(
                interaction,
                'No results found for this ID.\n> They are either fine or not yet listed.'
            );

        const imports = await db.getImports(id);
        if (imports.length === 0 && data.status === 'APPEALED')
            return sendSuccess(
                interaction,
                'No results found for this ID.\n> They are either fine or not yet listed.'
            );

        if (imports.length === 0 && ['PERM_BLACKLISTED', 'BLACKLISTED'].includes(data.status)) {
            const result = await db.failSafeStatus(data);
            if (result) {
                logger.debug({
                    labels: { action: 'checkuser', userId: id },
                    message: 'User being appealed',
                });
                sendSuccess(
                    interaction,
                    'No results found for this ID.\n> They are either fine or not yet listed.'
                );
                return actionAppeal(client, id);
            }
        }

        const types: UserType[] = imports.map(x => x.type);
        const highest = db.findHighestType(types);

        return sendEmbed({
            interaction,
            embed: {
                title: ':shield: User Blacklisted',
                description: `<@${id}> has been seen in ${imports.length} blacklisted Discords.`,
                author: {
                    name: data.last_username,
                    icon_url: data.avatar,
                },
                thumbnail: {
                    url: data.avatar,
                },
                color: Colours.RED,
                fields: [
                    {
                        name: 'User Information',
                        value: `> ID: ${id}\n> Name: ${data.last_username}\n> Status: ${capitalize(
                            data.status
                        )}\n> Type: ${capitalize(highest)}`,
                    },
                ],
            },
        });
    },
});
