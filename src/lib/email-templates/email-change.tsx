import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName, oldEmail, newEmail, confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>Account Security</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Confirm your email change</Heading>
          <Text style={styles.text}>
            You requested to change your {siteName} email address from{' '}
            <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Confirm email change</Button>
          </Section>
          <Section style={styles.panel}>
            <Text style={{ ...styles.footer, margin: 0 }}>
              If you didn't request this change, please secure your account immediately
              by resetting your password.
            </Text>
          </Section>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Multi-sig custody · TOTP-protected releases
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
