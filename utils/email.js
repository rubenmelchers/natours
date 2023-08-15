const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');

/**
 * @class sendEmail
 * - @param user. the user
 * - @param url
 */
module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstname = user.name.split(' ')[0];
    this.url = url;
    this.from = `Ruben Melchers <${process.env.EMAIL_FROM}>`;
    this.isProd = process.env.NODE_ENV === 'production';
  }

  newTransport() {
    if (this.isProd) {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_KEY
        }
      });
    }
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Mail send handler
   * @param template - the name of the HTML template
   * @param subject -
   */
  async send(template, subject) {
    /** 1. Render the HTML for the email. (from pug template) */
    //dirname === utils folder
    const html = pug.renderFile(
      `${__dirname}/../views/emails/${template}.pug`,
      {
        firstName: this.firstname,
        url: this.url,
        subject
      }
    );

    /** 2. Define email options */
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html) // also send the mail as text instead of rendered HTML
    };

    /** 3. Create a transport and send email */
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Reset your password. (valid for only 10 minutes)'
    );
  }
};
