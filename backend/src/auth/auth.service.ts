import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AccountType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.locked) throw new ForbiddenException({ code: 'ACCOUNT_LOCKED', message: 'Account restricted' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const token = await this.jwt.signAsync(payload);
    return { token, user: await this.prisma.user.findUnique({ where: { id: userId } }) };
  }

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    const allow = this.config.get<string>('ALLOW_REGISTRATION', 'true') !== 'false';
    if (!allow) throw new ForbiddenException({ code: 'REGISTRATION_DISABLED', message: 'Registration is closed' });

    const email = data.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already registered' });

    if (data.password.length < 8) {
      throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: data.fullName.trim(),
        phone: data.phone?.trim() || null,
        accounts: {
          create: {
            type: AccountType.CHECKING,
            nickname: 'Primary checking',
            mask: '••0001',
            balanceCents: 10000,
          },
        },
      },
    });

    await this.prisma.ledgerEntry.create({
      data: {
        accountId: (await this.prisma.account.findFirstOrThrow({ where: { userId: user.id } })).id,
        description: 'Welcome deposit',
        amountCents: 10000,
        balanceAfterCents: 10000,
        status: 'POSTED',
      },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const token = await this.jwt.signAsync(payload);
    return { token, user };
  }
}
