require('dotenv').config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ChannelType,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
  StringSelectMenuBuilder,
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const staffRoleId = process.env.STAFF_ROLE_ID || '1546846949691498577';
const ticketRoleId = '1546846949691498577';
const summonRoleId = '1546846949691498577';
const ticketLogChannelId = '1549714536888532992';



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
    .setCustomId('unclaim_ticket')
    .setLabel('فك الاستلام')
    .setEmoji({ name: '↩️' })
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('summon_staff')
    .setLabel('استدعاء مسؤول التكت')
    .setEmoji({ id: '1259540687653830686', name: '6_', animated: true })
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId('summon_owner')
    .setLabel('استدعاء صاحب التذكرة')
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
    .setLabel('فتح قائمة الطلبات')
    .setStyle(ButtonStyle.Primary),
);

const ticketTypeMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('ticket_type')
    .setPlaceholder('اختر نوع الطلب')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      {
        label: 'الدعم الفني',
        value: 'support',
        description: 'للحصول على المساعدة والدعم',
        emoji: { name: '🛠️' },
      },
      {
        label: 'الاقتراحات والشكاوى',
        value: 'suggestions',
        description: 'لإرسال اقتراح أو شكوى',
        emoji: { name: '💬' },
      },
      {
        label: 'تقديم على الادونز',
        value: 'addons',
        description: 'للتقديم على الادونز والطلبات الخاصة',
        emoji: { name: '📦' },
      },
    ),
);

const ticketRulesEmbed = new EmbedBuilder()
  .setColor(0x202225)
  .setTitle('قوانين التذاكر')
  .setDescription([
    '• الاحترام واجب وعدم التجاهل في التكت.',
    '• يمنع الفلص أو النقاشات خارج موضوع التذكرة.',
    '• في حال قمت بفتح تكت أدخل بالموضوع مباشرة.',
    '• يمنع السب والشتم أو الإهانة.',
    '• يجب أن تكون مشكلتك واضحة ومكتوبة بالتفصيل.',
    '• يمنع الإزعاج أو الإشارة إلى المستخدمين داخل التذكرة.',
    '• في حال احتجت إلى مساعدة اذكر جميع التفاصيل.',
    '',
    '**يجب عليك تعبئة البيانات قبل فتح التذكرة بشكل كامل.**',
    '',
    'بخلاف ذلك يحق للإدارة إغلاق التذكرة مباشرة.',
  ].join('\n'))
  .setFooter({ text: 'Powered By | FiveLab' });

const ticketReminderTimers = new Map();
const reminderInterval = 10 * 60 * 1000;
const ticketCloseDelay = 5 * 60 * 1000;

const claimedTicketOwners = new Map();

async function sendTicketLog(guild, title, fields, color = 0x5865f2) {
  try {
    const logChannel = await guild.channels.fetch(ticketLogChannelId);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .addFields(fields)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to send ticket log:', error);
  }
}

async function claimTicketForStaff(channel, staffId) {
  await channel.permissionOverwrites.edit(staffRoleId, {
    ViewChannel: true,
    SendMessages: false,
  });
  await channel.permissionOverwrites.edit(staffId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  claimedTicketOwners.set(channel.id, staffId);
}

async function unclaimTicketForStaff(channel, staffId) {
  await channel.permissionOverwrites.edit(staffRoleId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  await channel.permissionOverwrites.edit(staffId, {
    SendMessages: null,
  });
  claimedTicketOwners.delete(channel.id);
}

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
          await sendTicketLog(
            channel.guild,
            'TICKET_AUTO_CLOSED',
            [
              { name: '• معرف القناة', value: channel.id, inline: true },
              { name: '• اسم القناة', value: `#${channel.name}`, inline: true },
              { name: '• صاحب التذكرة', value: `<@${ownerId}>` },
            ],
            0xed4245,
          );
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
      embeds: [ticketRulesEmbed],
      components: [ticketTypeMenu],
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
      content: 'اختر نوع الطلب المناسب لك من القائمة:',
      components: [ticketTypeMenu],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
    const ticketType = interaction.values[0];
    const typeLabelMap = {
      support: 'الدعم الفني',
      suggestions: 'الاقتراحات والشكاوى',
      addons: 'تقديم على الادونز',
    };
    const typeLabel = typeLabelMap[ticketType] || 'التذكرة';
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
      await sendTicketLog(
        interaction.guild,
        'TICKET_CREATED',
        [
          { name: '• نوع التذكرة', value: typeLabel, inline: true },
          { name: '• اسم القناة', value: `#${ticketChannel.name}`, inline: true },
          { name: '• صاحب التذكرة', value: `<@${interaction.user.id}>` },
        ],
        0x57f287,
      );
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

    try {
      const currentClaimerId = claimedTicketOwners.get(interaction.channel.id);
      if (currentClaimerId && currentClaimerId !== interaction.user.id) {
        await interaction.reply({
          content: `التذكرة مستلمة من <@${currentClaimerId}>. يجب فك الاستلام أولًا.`,
          allowedMentions: { users: [currentClaimerId] },
          ephemeral: true,
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(ticketRoleId);
      await claimTicketForStaff(interaction.channel, interaction.user.id);
      const claimEmoji = interaction.client.emojis.cache.get('1259540712102297701');
      await interaction.reply({
        content: `تم استلام التذكرة بواسطة ${interaction.user}${claimEmoji ? ` ${claimEmoji}` : ''}`,
        allowedMentions: { users: [interaction.user.id] },
      });
      await sendTicketLog(
        interaction.guild,
        'TICKET_CLAIMED',
        [
          { name: '• المسؤول المستلم', value: `<@${interaction.user.id}>` },
          { name: '• معرف القناة', value: interaction.channel.id, inline: true },
          { name: '• اسم القناة', value: `#${interaction.channel.name}`, inline: true },
        ],
        0x57f287,
      );
    } catch (error) {
      console.error('Failed to claim ticket:', error);
      await interaction.reply('تعذر استلام التذكرة. تأكد أن للبوت Manage Roles وأن رتبة التكت أسفل رتبة البوت.');
    }
    return;
  }

  if (interaction.customId === 'unclaim_ticket') {
    if (!isStaff) {
      await interaction.reply({ content: 'هذا الزر للمسؤولين فقط.', ephemeral: true });
      return;
    }

    try {
      const currentClaimerId = claimedTicketOwners.get(interaction.channel.id);
      if (currentClaimerId && currentClaimerId !== interaction.user.id) {
        await interaction.reply({
          content: `لا يمكن فك الاستلام؛ التذكرة مستلمة من <@${currentClaimerId}>.`,
          allowedMentions: { users: [currentClaimerId] },
          ephemeral: true,
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.remove(ticketRoleId);
      await unclaimTicketForStaff(interaction.channel, interaction.user.id);
      await interaction.reply({
        content: `تم فك استلام التذكرة من ${interaction.user}`,
        allowedMentions: { users: [interaction.user.id] },
      });
      await sendTicketLog(
        interaction.guild,
        'TICKET_UNCLAIMED',
        [
          { name: '• المسؤول', value: `<@${interaction.user.id}>` },
          { name: '• معرف القناة', value: interaction.channel.id, inline: true },
          { name: '• اسم القناة', value: `#${interaction.channel.name}`, inline: true },
        ],
        0xfee75c,
      );
    } catch (error) {
      console.error('Failed to unclaim ticket:', error);
      await interaction.reply('تعذر فك الاستلام.');
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
      await sendTicketLog(
        interaction.guild,
        'TICKET_CLOSED',
        [
          { name: '• أغلقها من قبل', value: `<@${interaction.user.id}>` },
          { name: '• اسم المسؤول الذي أغلق', value: `<@${interaction.user.id}>` },
          { name: '• معرف القناة', value: interaction.channel.id, inline: true },
          { name: '• اسم القناة', value: `#${interaction.channel.name}`, inline: true },
          { name: '• صاحب التذكرة', value: ownerId ? `<@${ownerId}>` : 'غير معروف' },
        ],
        0xed4245,
      );
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
      await sendTicketLog(
        interaction.guild,
        'TICKET_REOPENED',
        [
          { name: '• فتحها من قبل', value: `<@${interaction.user.id}>` },
          { name: '• معرف القناة', value: interaction.channel.id, inline: true },
          { name: '• اسم القناة', value: `#${interaction.channel.name}`, inline: true },
          { name: '• صاحب التذكرة', value: ownerId ? `<@${ownerId}>` : 'غير معروف' },
        ],
        0x57f287,
      );
    } catch (error) {
      console.error('Failed to reopen ticket:', error);
      await interaction.followUp({ content: 'تعذر فتح التذكرة.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  if (interaction.customId === 'delete_ticket') {
    stopTicketReminder(interaction.channel.id);
    await sendTicketLog(
      interaction.guild,
      'TICKET_DELETED',
      [
        { name: '• حذفها من قبل', value: `<@${interaction.user.id}>` },
        { name: '• معرف القناة', value: interaction.channel.id, inline: true },
        { name: '• اسم القناة', value: `#${interaction.channel.name}`, inline: true },
        { name: '• صاحب التذكرة', value: ownerId ? `<@${ownerId}>` : 'غير معروف' },
      ],
      0xed4245,
    );
    await interaction.reply('سيتم حذف التذكرة خلال 3 ثوانٍ.');
    setTimeout(() => interaction.channel?.delete().catch(() => null), 3000);
  }
});

client.login(token);
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
