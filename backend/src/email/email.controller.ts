import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  IsEmail,
  validateOrReject,
  IsNotEmpty,
} from 'class-validator';
import * as nodemailer from 'nodemailer';
import { ImapFlow, MessageAddressObject, SearchObject } from 'imapflow';

class AccountConfigDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  @IsNotEmpty()
  user: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;
}

class FetchEmailsDto extends AccountConfigDto {
  @IsOptional()
  @IsString()
  mailbox?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  page?: number;
}

class FetchEmailBodyDto extends AccountConfigDto {
  @IsString()
  @IsNotEmpty()
  mailbox: string;

  @IsString()
  @IsNotEmpty()
  uid: string;
}

class FlagEmailDto extends AccountConfigDto {
  @IsString()
  @IsNotEmpty()
  mailbox: string;

  @IsString()
  @IsNotEmpty()
  uid: string;

  @IsString()
  @IsIn(['\\Seen', '\\Flagged', '\\Answered', '\\Deleted'])
  flag: string;

  @IsBoolean()
  value: boolean;
}

class MoveEmailDto extends AccountConfigDto {
  @IsString()
  @IsNotEmpty()
  sourceMailbox: string;

  @IsString()
  @IsNotEmpty()
  uid: string;

  @IsString()
  @IsNotEmpty()
  destinationMailbox: string;
}

class DeleteEmailDto extends AccountConfigDto {
  @IsString()
  @IsNotEmpty()
  mailbox: string;

  @IsString()
  @IsNotEmpty()
  uid: string;
}

class ListFoldersDto extends AccountConfigDto {}

class SearchQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  cc?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsBoolean()
  seen?: boolean;

  @IsOptional()
  @IsBoolean()
  flagged?: boolean;
}

class SearchEmailsDto extends AccountConfigDto {
  @IsOptional()
  @IsString()
  mailbox?: string;

  query: SearchQueryDto;
}

class SendEmailDto {
  // SMTP config
  @IsString()
  @IsNotEmpty()
  smtpHost: string;

  @IsNumber()
  smtpPort: number;

  @IsString()
  @IsNotEmpty()
  smtpUser: string;

  @IsString()
  @IsNotEmpty()
  smtpPassword: string;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSelfSigned?: boolean;

  // Message fields
  @IsEmail()
  from: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsArray()
  to: string[];

  @IsOptional()
  @IsArray()
  cc?: string[];

  @IsOptional()
  @IsArray()
  bcc?: string[];

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsIn(['high', 'normal', 'low'])
  priority?: string;

  @IsOptional()
  @IsBoolean()
  requestReadReceipt?: boolean;

  @IsOptional()
  @IsString()
  replyTo?: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @IsOptional()
  @IsString()
  references?: string;
}

class TestConnectionDto extends AccountConfigDto {
  @IsIn(['imap', 'smtp'])
  protocol: 'imap' | 'smtp';

  @IsOptional()
  @IsNumber()
  smtpPort?: number;
}

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  /**
   * Test IMAP or SMTP connection with provided credentials
   */
  @Post('test')
  async testConnection(@Body() dto: TestConnectionDto): Promise<{ success: boolean; message: string }> {
    const dtoObj = Object.assign(new TestConnectionDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };

    if (dto.protocol === 'imap') {
      const client = new ImapFlow({
        host: dto.host,
        port: dto.port,
        secure: dto.secure !== false,
        auth: { user: dto.user, pass: dto.password },
        tls,
        logger: false,
      });
      try {
        await client.connect();
        await client.logout();
        return { success: true, message: 'IMAP connection successful' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new InternalServerErrorException(`IMAP connection failed: ${msg}`);
      }
    } else {
      const transporter = nodemailer.createTransport({
        host: dto.host,
        port: dto.smtpPort ?? dto.port,
        secure: dto.secure !== false,
        auth: { user: dto.user, pass: dto.password },
        tls,
      });
      try {
        await transporter.verify();
        transporter.close();
        return { success: true, message: 'SMTP connection successful' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new InternalServerErrorException(`SMTP connection failed: ${msg}`);
      }
    }
  }

  /**
   * Fetch email list from an IMAP mailbox
   */
  @Post('fetch')
  async fetchEmails(@Body() dto: FetchEmailsDto): Promise<object> {
    const dtoObj = Object.assign(new FetchEmailsDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const mailbox = dto.mailbox || 'INBOX';
    const limit = Math.min(dto.limit ?? 50, 200);
    const page = Math.max(dto.page ?? 1, 1);
    const tls = { rejectUnauthorized: !dto.allowSelfSigned };

    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(mailbox);
      try {
        const status = await client.status(mailbox, { messages: true, unseen: true });
        const total = status.messages ?? 0;
        const unseenCount = status.unseen ?? 0;

        const start = Math.max(1, total - (page * limit) + 1);
        const end = Math.max(1, total - ((page - 1) * limit));

        const messages: object[] = [];

        if (total > 0 && start <= end) {
          for await (const msg of client.fetch(
            `${start}:${end}`,
            { uid: true, flags: true, envelope: true, internalDate: true, bodyStructure: true },
          )) {
            messages.push({
              uid: msg.uid,
              seq: msg.seq,
              flags: [...(msg.flags ?? [])],
              subject: msg.envelope?.subject ?? '',
              from: msg.envelope?.from?.map(a => ({ name: a.name, address: a.address })) ?? [],
              to: msg.envelope?.to?.map(a => ({ name: a.name, address: a.address })) ?? [],
              cc: msg.envelope?.cc?.map(a => ({ name: a.name, address: a.address })) ?? [],
              date: msg.envelope?.date ?? msg.internalDate,
              messageId: msg.envelope?.messageId,
              inReplyTo: msg.envelope?.inReplyTo,
              hasAttachment: this.hasAttachment(msg.bodyStructure),
            });
          }
        }

        messages.reverse();
        return { messages, total, unseen: unseenCount, page, limit, mailbox };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to fetch emails: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * Fetch full body of a single email by UID
   */
  @Post('body')
  async fetchEmailBody(@Body() dto: FetchEmailBodyDto): Promise<object> {
    const dtoObj = Object.assign(new FetchEmailBodyDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(dto.mailbox);
      try {
        const msg = await client.fetchOne(dto.uid, { source: true, flags: true, envelope: true }, { uid: true });
        if (!msg) throw new BadRequestException('Email not found');

        const source = msg.source?.toString('utf-8') ?? '';
        // Mark as seen
        await client.messageFlagsAdd(dto.uid, ['\\Seen'], { uid: true });

        return {
          uid: msg.uid,
          flags: [...(msg.flags ?? [])],
          subject: msg.envelope?.subject ?? '',
          from: msg.envelope?.from?.map(a => ({ name: a.name, address: a.address })) ?? [],
          to: msg.envelope?.to?.map(a => ({ name: a.name, address: a.address })) ?? [],
          cc: msg.envelope?.cc?.map(a => ({ name: a.name, address: a.address })) ?? [],
          date: msg.envelope?.date,
          messageId: msg.envelope?.messageId,
          inReplyTo: msg.envelope?.inReplyTo,
          source,
        };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to fetch email body: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * List IMAP folders/mailboxes
   */
  @Post('folders')
  async listFolders(@Body() dto: ListFoldersDto): Promise<object[]> {
    const dtoObj = Object.assign(new ListFoldersDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const list = await client.list();
      return list.map(folder => ({
        path: folder.path,
        name: folder.name,
        delimiter: folder.delimiter,
        flags: [...(folder.flags ?? [])],
        specialUse: (folder as { specialUse?: string }).specialUse ?? null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to list folders: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * Set or clear a flag on a message
   */
  @Post('flag')
  async flagEmail(@Body() dto: FlagEmailDto): Promise<{ success: boolean }> {
    const dtoObj = Object.assign(new FlagEmailDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(dto.mailbox);
      try {
        if (dto.value) {
          await client.messageFlagsAdd(dto.uid, [dto.flag], { uid: true });
        } else {
          await client.messageFlagsRemove(dto.uid, [dto.flag], { uid: true });
        }
        return { success: true };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to update flag: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * Move an email to another mailbox
   */
  @Post('move')
  async moveEmail(@Body() dto: MoveEmailDto): Promise<{ success: boolean }> {
    const dtoObj = Object.assign(new MoveEmailDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(dto.sourceMailbox);
      try {
        await client.messageMove(dto.uid, dto.destinationMailbox, { uid: true });
        return { success: true };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to move email: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * Delete (expunge) an email
   */
  @Post('delete')
  async deleteEmail(@Body() dto: DeleteEmailDto): Promise<{ success: boolean }> {
    const dtoObj = Object.assign(new DeleteEmailDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(dto.mailbox);
      try {
        await client.messageFlagsAdd(dto.uid, ['\\Deleted'], { uid: true });
        await client.messageDelete(dto.uid, { uid: true });
        return { success: true };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to delete email: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  /**
   * Send an email via SMTP
   */
  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto): Promise<{ success: boolean; messageId?: string }> {
    const dtoObj = Object.assign(new SendEmailDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const transporter = nodemailer.createTransport({
      host: dto.smtpHost,
      port: dto.smtpPort,
      secure: dto.smtpSecure !== false,
      auth: { user: dto.smtpUser, pass: dto.smtpPassword },
      tls,
    });

    const headers: Record<string, string> = {};
    if (dto.requestReadReceipt) {
      headers['Disposition-Notification-To'] = dto.from;
      headers['Return-Receipt-To'] = dto.from;
    }
    if (dto.priority === 'high') {
      headers['X-Priority'] = '1';
      headers['Importance'] = 'high';
    } else if (dto.priority === 'low') {
      headers['X-Priority'] = '5';
      headers['Importance'] = 'low';
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: dto.fromName ? `"${dto.fromName}" <${dto.from}>` : dto.from,
      to: dto.to.join(', '),
      cc: dto.cc?.length ? dto.cc.join(', ') : undefined,
      bcc: dto.bcc?.length ? dto.bcc.join(', ') : undefined,
      subject: dto.subject,
      text: dto.text,
      html: dto.html,
      replyTo: dto.replyTo,
      inReplyTo: dto.inReplyTo,
      references: dto.references,
      headers,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      transporter.close();
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to send email: ${msg}`);
    }
  }

  /**
   * Search emails in a mailbox
   */
  @Post('search')
  async searchEmails(@Body() dto: SearchEmailsDto): Promise<object> {
    const dtoObj = Object.assign(new SearchEmailsDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    const tls = { rejectUnauthorized: !dto.allowSelfSigned };
    const client = new ImapFlow({
      host: dto.host,
      port: dto.port,
      secure: dto.secure !== false,
      auth: { user: dto.user, pass: dto.password },
      tls,
      logger: false,
    });

    const query = dto.query ?? {};
    try {
      await client.connect();
      const mailbox = dto.mailbox || 'INBOX';
      const lock = await client.getMailboxLock(mailbox);
      try {
        const searchQuery: SearchObject = {};
        if (query.from) searchQuery.from = query.from;
        if (query.to) searchQuery.to = query.to;
        if (query.cc) searchQuery.cc = query.cc;
        if (query.subject) searchQuery.subject = query.subject;
        if (query.body) searchQuery.body = query.body;
        if (query.since) searchQuery.since = new Date(query.since);
        if (query.before) searchQuery.before = new Date(query.before);
        if (query.seen !== undefined) searchQuery.seen = query.seen;
        if (query.flagged === true) searchQuery.flagged = true;

        const uids = await client.search(
          Object.keys(searchQuery).length > 0 ? searchQuery : { all: true },
          { uid: true },
        );

        const messages: object[] = [];
        const uidList = Array.isArray(uids) ? uids : [];
        if (uidList.length > 0) {
          const limited = uidList.slice(-100).join(',');
          for await (const msg of client.fetch(limited, {
            uid: true, flags: true, envelope: true, internalDate: true,
          }, { uid: true })) {
            messages.push({
              uid: msg.uid,
              flags: [...(msg.flags ?? [])],
              subject: msg.envelope?.subject ?? '',
              from: msg.envelope?.from?.map((a: MessageAddressObject) => ({ name: a.name, address: a.address })) ?? [],
              to: msg.envelope?.to?.map((a: MessageAddressObject) => ({ name: a.name, address: a.address })) ?? [],
              date: msg.envelope?.date ?? msg.internalDate,
            });
          }
        }

        messages.reverse();
        return { messages, total: uidList.length, mailbox };
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Search failed: ${msg}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private hasAttachment(structure: object | null | undefined): boolean {
    if (!structure) return false;
    const s = structure as { type?: string; disposition?: { value?: string }; childNodes?: object[] };
    if (
      s.disposition?.value?.toLowerCase() === 'attachment' ||
      (s.type?.toLowerCase() !== 'text' && s.type?.toLowerCase() !== 'multipart' && s.type)
    ) {
      return true;
    }
    if (s.childNodes) {
      return s.childNodes.some(child => this.hasAttachment(child));
    }
    return false;
  }
}
