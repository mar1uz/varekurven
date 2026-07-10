import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

dotenv.config();

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    let key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      // Remove any whitespace (like spaces or newlines) from accidental copy-pastes
      key = key.trim().replace(/\s+/g, '');
    }
    if (!key || key === 'sk_test_123') {
      throw new Error('STRIPE_SECRET_KEY is not configured. Please add a valid Stripe API key in the environment variables.');
    }
    if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
      throw new Error('Invalid STRIPE_SECRET_KEY format. It should start with "sk_" (secret key) or "rk_" (restricted key). You provided: ' + key.substring(0, 4) + '...');
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
          allowed_countries: ['NO'],
        },
        phone_number_collection: {
          enabled: true,
        },
        invoice_creation: {
          enabled: true,
        },
        line_items: [
          {
            price_data: {
              currency: 'nok',
              product_data: {
                name: 'Premium Kjølematte for Hund',
                description: 'Avansert termisk teknologi og skandinavisk minimalisme.',
                images: ['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=1000'],
              },
              unit_amount: 39900, // 399.00 NOK
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?canceled=true`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/verify-session', async (req, res) => {
    try {
      const stripe = getStripe();
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing session_id' });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error: any) {
      console.error('Stripe verify error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/send-email', async (req, res) => {
    try {
      const { orderDetails, toEmail } = req.body;
      console.log('Sending email for order:', orderDetails);

      const customerEmail = orderDetails.customer_details?.email;
      const adminEmail = process.env.ADMIN_EMAIL || customerEmail || 'admin@kjolematte.no'; // Fallback to customer email in test mode if ADMIN_EMAIL is missing
      
      const adminSubject = `Ny bestilling! Ordre fra ${orderDetails.customer_details?.name || 'Kunde'}`;
      const adminText = `Du har fått en ny bestilling!\n\nKunde: ${orderDetails.customer_details?.name}\nE-post: ${orderDetails.customer_details?.email}\nBeløp: ${orderDetails.amount_total / 100} NOK\nStatus: ${orderDetails.payment_status}\n\nLeveringsadresse:\n${orderDetails.shipping_details?.address?.line1}\n${orderDetails.shipping_details?.address?.postal_code} ${orderDetails.shipping_details?.address?.city}\n${orderDetails.shipping_details?.address?.country}`;
      
      const customerSubject = `Din kvittering / faktura fra Kjølematte Butikk`;
      const customerText = `Hei ${orderDetails.customer_details?.name || 'Kunde'}!\n\nTakk for din bestilling.\n\nDette er en bekreftelse på at vi har mottatt din ordre på ${orderDetails.amount_total / 100} NOK.\n\nStripe vil også sende deg en formell faktura på denne e-posten.\n\nLeveringsadresse:\n${orderDetails.shipping_details?.address?.line1}\n${orderDetails.shipping_details?.address?.postal_code} ${orderDetails.shipping_details?.address?.city}\n${orderDetails.shipping_details?.address?.country}\n\nMed vennlig hilsen,\nKjølematte Butikk`;

      // 1. Try RESEND first
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        console.log('Using Resend to send emails');
        
        // Admin email
        const adminRes = await resend.emails.send({
          from: 'Kjølematte Butikk <onboarding@resend.dev>', // Resend test domain
          to: adminEmail,
          subject: adminSubject,
          text: adminText,
        });

        if (adminRes.error) {
          console.error("Resend Admin Email Error:", adminRes.error);
        } else {
          console.log("Resend Admin Email Success:", adminRes.data);
        }

        // Customer email
        let customerRes;
        if (customerEmail) {
          customerRes = await resend.emails.send({
            from: 'Kjølematte Butikk <onboarding@resend.dev>', // Resend test domain
            to: customerEmail, 
            subject: customerSubject,
            text: customerText,
          });
          
          if (customerRes.error) {
            console.error("Resend Customer Email Error:", customerRes.error);
          } else {
            console.log("Resend Customer Email Success:", customerRes.data);
          }
        }
        
        return res.json({ success: true, method: 'resend', adminResponse: adminRes, customerResponse: customerRes });
      }

      // 2. Try SMTP
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      let transporter;
      let isEthereal = false;
      
      if (host && user && pass) {
        transporter = nodemailer.createTransport({
          host: host,
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: { user, pass },
        });
      } else {
        console.warn('No email provider configured. Generating Ethereal test account to preview emails...');
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        isEthereal = true;
      }
      
      // Admin notification
      const adminInfo = await transporter.sendMail({
        from: '"Kjølematte Butikk" <noreply@kjolematte.no>',
        to: adminEmail,
        subject: adminSubject,
        text: adminText,
      });

      // Customer confirmation/invoice
      let customerInfo;
      if (customerEmail) {
        customerInfo = await transporter.sendMail({
          from: '"Kjølematte Butikk" <noreply@kjolematte.no>',
          to: customerEmail,
          subject: customerSubject,
          text: customerText,
        });
      }

      if (isEthereal) {
        console.log("-----------------------------------------");
        console.log("TEST EMAIL SENT (Sandbox Ethereal Email)");
        console.log("Admin Email Preview URL: %s", nodemailer.getTestMessageUrl(adminInfo));
        if (customerInfo) {
          console.log("Customer Email Preview URL: %s", nodemailer.getTestMessageUrl(customerInfo));
        }
        console.log("-----------------------------------------");
      }

      res.json({ 
        success: true, 
        method: isEthereal ? 'ethereal' : 'smtp',
        adminMessageId: adminInfo.messageId, 
        customerMessageId: customerInfo?.messageId,
        adminPreviewUrl: isEthereal ? nodemailer.getTestMessageUrl(adminInfo) : null,
        customerPreviewUrl: isEthereal && customerInfo ? nodemailer.getTestMessageUrl(customerInfo) : null
      });
    } catch (error: any) {
      console.error('Email error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
