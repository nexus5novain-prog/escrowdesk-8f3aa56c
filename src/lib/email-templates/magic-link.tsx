import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your one-time sign-in link for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>Sign-in Link</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Sign in to {siteName}</Heading>
          <Text style={styles.text}>
            Click the button below to securely sign in. This one-time link expires shortly
            and can only be used once.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Sign in</Button>
          </Section>
          <Text style={styles.footer}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Multi-sig custody · TOTP-protected releases
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
