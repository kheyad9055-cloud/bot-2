


require('dotenv').config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ChannelType,
  GatewayIntentBits,
  PermissionsBitField,
  StringSelectMenuBuilder,
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const staffRoleId = process.env.STAFF_ROLE_ID || '1546846949691498577';
const ticketRoleId = '1546846949691498577';
const summonRoleId = '1546846949691498577';



const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const prefix = '!';
const automaticReplies = new Map([
  ['السلام عليكم', 'وعليكم السلام ورحمة الله وبركاته'],
  ['هلا', 'هلا والله!'],
  ['بوت', 'معك، وش تحتاج؟'],
]);

client.once('ready', (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

const ticketButton = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('claim_ticket')
    .setLabel('استلام التذكرة')
    .setEmoji({ id: '1270029062647185439', name: 'online', animated: false })
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('summon_staff')
    .setLabel('استدعاء الرتبة')
    .setEmoji({ id: '1259540687653830686', name: '6_', animated: true })
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId('summon_owner')
    .setLabel('استدعاء الأونر')
    .setEmoji({ id: '1259540687653830686', name: '6_', animated: true })
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('إغلاق التذكرة')
    .setEmoji({ id: '1475160139874041866', name: 'false', animated: true })
    .setStyle(ButtonStyle.Danger),
);

const closedTicketButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('reopen_ticket')
    .setLabel('فتح التذكرة')
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('delete_ticket')
    .setLabel('حذف التذكرة')
    .setStyle(ButtonStyle.Danger),
);

const ticketPanel = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('open_ticket')
    .setLabel('إنشاء التذاكر')
    .setStyle(ButtonStyle.Primary),
);

const ticketTypeMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('ticket_type')
    .setPlaceholder('اختر خيار التذكرة')
    .addOptions(
      {
        label: 'الدعم الفني',
        value: 'support',
        description: 'للحصول على المساعدة والدعم',
      },
      {
        label: 'الاقتراحات والشكاوى',
        value: 'suggestions',
        description: 'لإرسال اقتراح أو شكوى',
      },
    ),
);

const ticketReminderTimers = new Map();
const reminderInterval = 10 * 60 * 1000;
const ticketCloseDelay = 5 * 60 * 1000;

function stopTicketReminder(channelId) {
  const timers = ticketReminderTimers.get(channelId);
  if (timers) {
    clearTimeout(timers.warningTimer);
    clearTimeout(timers.closeTimer);
  }
  ticketReminderTimers.delete(channelId);
}

function startTicketReminder(channel, ownerId) {
  stopTicketReminder(channel.id);
  const warningTimer = setTimeout(async () => {
    try {
      await channel.send({
      content: `<@${ownerId}> سيتم إغلاق التذكرة في حال عدم ردك.`,
      allowedMentions: { users: [ownerId] },
      });

      const closeTimer = setTimeout(async () => {
        try {
          await channel.permissionOverwrites.edit(ownerId, {
            ViewChannel: false,
            SendMessages: false,
          });
          await channel.send({
            content: 'تم إغلاق التذكرة تلقائيًا لعدم وجود رد خلال 5 دقائق.',
            components: [closedTicketButtons],
          });
        } catch (error) {
          console.error('Failed to auto-close ticket:', error);
        } finally {
          stopTicketReminder(channel.id);
        }
      }, ticketCloseDelay);

      const timers = ticketReminderTimers.get(channel.id);
      if (timers) timers.closeTimer = closeTimer;
    } catch (error) {
      stopTicketReminder(channel.id);
    }
  }, reminderInterval);

  ticketReminderTimers.set(channel.id, { warningTimer, closeTimer: null });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const command = content.toLowerCase();
    const ticketOwnerId = message.channel.name.split('-').at(-1);

    if (/^\d{17,20}$/.test(ticketOwnerId) && message.author.id === ticketOwnerId) {
    startTicketReminder(message.channel, ticketOwnerId);
  }

  if (command === `${prefix}قفل` || command === `${prefix}lock`) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return;
    }

    const everyoneRole = message.guild.roles.everyone;
    const canManageChannel = message.channel
      .permissionsFor(message.guild.members.me)
      ?.has(PermissionsBitField.Flags.ManageChannels);

    if (!canManageChannel) {
      return;
    }

    try {
      await message.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
      });
    } catch (error) {
      console.error('Failed to lock channel:', error);
      await message.reply('ما قدرت أقفل الروم. تأكد من ترتيب رتب البوت وصلاحياته.');
    }
    return;
  }

  if (command === `${prefix}فتح` || command === `${prefix}unlock`) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return;
    }

    const everyoneRole = message.guild.roles.everyone;
    const canManageChannel = message.channel
      .permissionsFor(message.guild.members.me)
      ?.has(PermissionsBitField.Flags.ManageChannels);

    if (!canManageChannel) {
      return;
    }

    try {
      await message.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null,
      });
    } catch (error) {
      console.error('Failed to unlock channel:', error);
      await message.reply('ما قدرت أفتح الروم. تأكد من ترتيب رتب البوت وصلاحياته.');
    }
    return;
  }

  if (command.startsWith(`${prefix}ban`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    const canBanMembers = message.guild.members.me
      ?.permissions.has(PermissionsBitField.Flags.BanMembers);
    const targetId = message.mentions.users.first()?.id || content.split(/\s+/)[1];
    let targetMember;

    if (!canBanMembers || !targetId || !/^\d{17,20}$/.test(targetId)) {
      return;
    }

    try {
      targetMember = await message.guild.members.fetch(targetId);
      if (!targetMember.bannable) {
        return;
      }

      await targetMember.ban({ reason: `Banned by ${message.author.tag}` });
      await message.reply('Banned successfully');
    } catch (error) {
      console.error('Failed to ban member:', error);
    }
    return;
  }

  if (command.startsWith(`${prefix}unban`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    const userId = message.mentions.users.first()?.id
      || content.match(/(?:<@!?(\d{17,20})>|(\d{17,20}))/)?.slice(1).find(Boolean);
    const canBanMembers = message.guild.members.me
      ?.permissions.has(PermissionsBitField.Flags.BanMembers);

    if (!canBanMembers || !userId || !/^\d{17,20}$/.test(userId)) {
      return;
    }

    try {
      await message.guild.bans.remove(userId);
      await message.reply('Unbanned successfully');
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
    return;
  }

  if (command.startsWith(`${prefix}مسح`) || command.startsWith(`${prefix}clear`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    const amountText = content.split(/\s+/)[1];
    const amount = amountText ? Number.parseInt(amountText, 10) : null;
    const canManageMessages = message.guild.members.me
      ?.permissions.has(PermissionsBitField.Flags.ManageMessages);

    if (!canManageMessages || (amount !== null && (!Number.isInteger(amount) || amount < 1 || amount > 100))) {
      return;
    }

    try {
      await message.delete();

      if (amount !== null) {
        await message.channel.bulkDelete(amount, true);
        return;
      }

      while (true) {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        if (messages.size === 0) break;

        const deletedMessages = await message.channel.bulkDelete(messages, true);
        if (deletedMessages.size === 0) {
          await Promise.all(messages.map((channelMessage) => channelMessage.delete().catch(() => null)));
          break;
        }
      }
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
    return;
  }

  if (command === `${prefix}تذكرة` || command === `${prefix}ticket`) {
    await message.channel.send({
      content: 'اضغط على الزر لإنشاء تذكرة جديدة.',
      components: [ticketPanel],
    });
    return;
  }

  const automaticReply = automaticReplies.get(content.toLowerCase());
  if (automaticReply) {
    await message.reply(automaticReply);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    await interaction.reply({
      content: 'اختر نوع التذكرة من القائمة:',
      components: [ticketTypeMenu],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
    const ticketType = interaction.values[0];
    const typeLabel = ticketType === 'support' ? 'الدعم الفني' : 'الاقتراحات والشكاوى';
    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      await interaction.reply({ content: 'البوت يحتاج صلاحية إدارة القنوات.', ephemeral: true });
      return;
    }

    try {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${ticketType}-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: '1547208045942018119',
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: botMember.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
          {
            id: staffRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });

      await ticketChannel.send({
        content: `<@&${staffRoleId}>\nمرحبًا ${interaction.user}، هذه تذكرة **${typeLabel}**. اكتب طلبك هنا.`,
        allowedMentions: { roles: [staffRoleId], users: [interaction.user.id] },
        components: [ticketButton],
      });
      startTicketReminder(ticketChannel, interaction.user.id);
      await interaction.reply({ content: `تم إنشاء تذكرتك: ${ticketChannel}`, ephemeral: true });
    } catch (error) {
      console.error('Failed to create ticket:', error);
      await interaction.reply({ content: 'تعذر إنشاء التذكرة.', ephemeral: true });
    }
    return;
  }

  if (!interaction.isButton()) return;

  const isTicket = interaction.channel?.name.startsWith('ticket-');
  const interactingMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const isStaff = interactingMember?.permissions.has(PermissionsBitField.Flags.Administrator)
    || interactingMember?.permissions.has(PermissionsBitField.Flags.ManageChannels)
    || interactingMember?.roles.cache.has(staffRoleId);
  const ownerId = interaction.channel?.name.match(/-(\d{17,20})$/)?.[1];
  const isTicketOwner = ownerId === interaction.user.id;

  if (!isTicket || (!isStaff && !isTicketOwner)) {
    await interaction.reply({ content: 'لا تملك صلاحية إغلاق هذه التذكرة.', ephemeral: true });
    return;
  }

  if (interaction.customId === 'claim_ticket') {
    if (!isStaff) {
      await interaction.reply({ content: 'هذا الزر للمسؤولين فقط.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(ticketRoleId);
      const claimEmoji = interaction.client.emojis.cache.get('1259540712102297701');
      await interaction.editReply({
        content: `تم استلام التذكرة بواسطة ${interaction.user}${claimEmoji ? ` ${claimEmoji}` : ''}`,
        allowedMentions: { users: [interaction.user.id] },
      });
    } catch (error) {
      console.error('Failed to claim ticket:', error);
      await interaction.editReply('تعذر استلام التذكرة. تأكد أن للبوت Manage Roles وأن رتبة التكت أسفل رتبة البوت.');
    }
    return;
  }

  if (interaction.customId === 'summon_staff') {
    if (!isStaff && !isTicketOwner) {
      await interaction.reply({ content: 'لا تملك صلاحية استخدام هذا الزر.', ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `<@&${summonRoleId}>`,
      allowedMentions: { roles: [summonRoleId] },
    });
    return;
  }

  if (interaction.customId === 'summon_owner') {
    if (!isStaff) {
      await interaction.reply({ content: 'هذا الزر للمسؤولين فقط.', ephemeral: true });
      return;
    }

    if (!ownerId) {
      await interaction.reply({ content: 'تعذر العثور على صاحب التذكرة.', ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `<@${ownerId}>`,
      allowedMentions: { users: [ownerId] },
    });
    return;
  }

  if (interaction.customId === 'close_ticket') {
    if (!ownerId) return;

    try {
      stopTicketReminder(interaction.channel.id);
      await interaction.deferUpdate();
      await interaction.channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: false,
        SendMessages: false,
      });
      await interaction.message.edit({
        content: 'تم إغلاق التذكرة. يمكن للمسؤول فتحها أو حذفها.',
        components: [closedTicketButtons],
      });
    } catch (error) {
      console.error('Failed to close ticket:', error);
      await interaction.followUp({ content: 'تعذر إغلاق التذكرة.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  if (!isStaff) {
    await interaction.reply({ content: 'هذا الخيار للمسؤولين فقط.', ephemeral: true });
    return;
  }

  if (interaction.customId === 'reopen_ticket') {
    if (!ownerId) return;

    try {
      startTicketReminder(interaction.channel, ownerId);
      await interaction.deferUpdate();
      await interaction.channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await interaction.message.edit({
        content: 'تم فتح التذكرة من جديد.',
        components: [ticketButton],
      });
    } catch (error) {
      console.error('Failed to reopen ticket:', error);
      await interaction.followUp({ content: 'تعذر فتح التذكرة.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  if (interaction.customId === 'delete_ticket') {
    stopTicketReminder(interaction.channel.id);
    await interaction.reply('سيتم حذف التذكرة خلال 3 ثوانٍ.');
    setTimeout(() => interaction.channel?.delete().catch(() => null), 3000);
  }
});

client.login(token);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});