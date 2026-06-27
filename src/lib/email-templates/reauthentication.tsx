import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface ReauthenticationEmailProps {
  siteName?: string
  token: string
}

export const ReauthenticationEmail = ({ siteName = 'EscrowDesk', token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>Verification Code</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Confirm it's you</Heading>
          <Text style={styles.text}>
            Use the code below to confirm your identity and complete this sensitive action.
          </Text>
          <Text style={styles.codeStyle}>{token}</Text>
          <Text style={styles.footer}>
            This code will expire shortly. If you didn't request it, ignore this email
            and consider resetting your password.
          </Text>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Never share this code with anyone
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
