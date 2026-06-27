import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import { styles } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.brandRow}>{siteName}</Text>
          <Text style={styles.brandTag}>Account Security</Text>
        </Section>
        <Section style={styles.body}>
          <Heading style={styles.h1}>Reset your password</Heading>
          <Text style={styles.text}>
            We received a request to reset the password for your {siteName} account.
            Choose a new password by clicking the button below.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Reset password</Button>
          </Section>
          <Section style={styles.panel}>
            <Text style={{ ...styles.footer, margin: 0 }}>
              This link expires shortly and can only be used once. If you didn't request a
              reset, ignore this email — your password will not change.
            </Text>
          </Section>
        </Section>
        <Section style={styles.footerBar}>
          {siteName} · Never share this link with anyone
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
