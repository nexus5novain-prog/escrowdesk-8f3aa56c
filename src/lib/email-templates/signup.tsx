import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to activate your {siteName} account</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>Secure P2P Escrow</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Verify your email</Heading>
          <Text style={styles.text}>
            Welcome to <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>.
            Confirm <strong>{recipient}</strong> to activate your account and start trading
            with on-platform escrow protection.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Verify email address</Button>
          </Section>
          <Section style={styles.panel}>
            <Text style={{ ...styles.footer, margin: 0 }}>
              For your security, this link expires shortly. If the button doesn't work,
              copy and paste this URL into your browser:
            </Text>
            <Text style={{ ...styles.footer, wordBreak: 'break-all', margin: '6px 0 0' }}>
              {confirmationUrl}
            </Text>
          </Section>
          <Text style={styles.footer}>
            Didn't create an account? You can safely ignore this email.
          </Text>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Multi-sig custody · TOTP-protected releases
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
