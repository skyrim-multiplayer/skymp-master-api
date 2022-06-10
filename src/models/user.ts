import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  PrimaryColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn
} from "typeorm";
import { Length, IsEmail } from "class-validator";

import { hashString } from "../utils/hashString";

export const VERIFICATION_EXPIRES = 2 * 60 * 1000;

export enum Roles {
  user = "user",
  admin = "admin"
}

export function makeFakeDiscordEmail(discordId: string) {
  return discordId + '@fake-discord-email.skymp.io';
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @PrimaryColumn("varchar", { length: 32, nullable: false, unique: true })
  @Length(2, 32)
  name!: string;

  @PrimaryColumn("varchar", { length: 100, unique: true, nullable: false })
  @Length(5, 100)
  @IsEmail()
  email!: string;
  // Fake emails built from Discord ids:
  // 321635713512357216132@fake-discord-email.skymp.io

  @Column("varchar", { name: "password", nullable: false, length: 100 })
  @Length(6)
  password!: string;

  @Column("boolean", {
    name: "has_verified_email",
    default: true,
    nullable: false
  })
  hasVerifiedEmail!: boolean;

  @Column("varchar", {
    name: "verification_pin",
    nullable: true,
    default: null
  })
  verificationPin!: string;

  @Column("timestamp", {
    name: "verification_pin_sent_at",
    nullable: true,
    default: null
  })
  verificationPinSentAt!: Date;

  /*
  Not work with enum
  https://github.com/typeorm/typeorm/issues/4350
  */
  @Column("varchar", {
    name: "roles",
    default: `{${Roles.user}}`,
    nullable: false,
    array: true
  })
  roles!: Roles[];

  @CreateDateColumn({
    name: "create_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP"
  })
  createAt!: Date;

  @UpdateDateColumn({
    name: "update_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP"
  })
  updateAt!: Date;

  @Column("varchar", {
    name: "current_server_address",
    nullable: true,
    default: null
  })
  currentServerAddress!: string;

  @Column("varchar", {
    name: "current_session",
    nullable: true,
    default: null
  })
  currentSession!: string;

  @Column("varchar", {
    name: "discord_id",
    nullable: true,
    default: null
  })
  discordId!: string | null;

  @Column("varchar", {
    name: "discord_username",
    nullable: true,
    default: null
  })
  discordUsername!: string | null;

  @Column("varchar", {
    name: "discord_discriminator",
    nullable: true,
    default: null
  })
  discordDiscriminator!: string | null;

  @Column("varchar", {
    name: "discord_avatar",
    nullable: true,
    default: null
  })
  discordAvatar!: string | null;

  @BeforeInsert()
  async hashPassword(): Promise<void> {
    this.password = await hashString(this.password, this.email);
  }
}
