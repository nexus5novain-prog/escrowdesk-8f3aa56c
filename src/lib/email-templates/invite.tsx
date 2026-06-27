import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>You're invited</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Join {siteName}</Heading>
          <Text style={styles.text}>
            You've been invited to join{' '}
            <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>,
            the secure peer-to-peer escrow platform. Accept the invitation to create
            your account.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Accept invitation</Button>
          </Section>
          <Text style={styles.footer}>
            If you weren't expecting this invitation, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Multi-sig custody · TOTP-protected releases
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
