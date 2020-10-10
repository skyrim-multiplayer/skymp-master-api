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

import { sendSignupVerifyPin } from "../emails";

import { hashString } from "../utils/hashString";

export const VERIFICATION_EXPIRES = 2 * 60 * 1000;

export enum Roles {
  user = "user",
  admin = "admin"
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

  @Column("varchar", { name: "password", nullable: false, length: 100 })
  @Length(6)
  password!: string;

  @Column("boolean", {
    name: "has_verified_email",
    default: false,
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

  @BeforeInsert()
  async hashPassword(): Promise<void> {
    this.password = await hashString(this.password, this.email);
  }

  @BeforeInsert()
  async sendVerifyPin(): Promise<void> {
    const pin = this.verificationPin;
    this.verificationPin = await hashString(pin, this.email);
    this.verificationPinSentAt = new Date();

    const url = `https://skymp.io/api/enduser-verify/${this.email}/${pin}`;
    await sendSignupVerifyPin(this.email, this.name, url);
  }
}
