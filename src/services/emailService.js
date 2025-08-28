const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send email to new editor with credentials
   */
  async sendEditorCredentials(editorData, temporaryPassword) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: editorData.email,
        subject: 'Welcome to Ctrl E - Your Editor Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Welcome to Ctrl E</h1>
              <p style="color: white; margin: 10px 0 0 0;">Video Editing CRM Platform</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${editorData.name},</h2>
              
              <p style="color: #666; line-height: 1.6;">
                You have been added as an Editor to the Ctrl E video editing platform. 
                You can now log in and start working on assigned projects.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Your Login Credentials:</h3>
                <p style="margin: 10px 0;"><strong>Email:</strong> ${editorData.email}</p>
                <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
                <p style="color: #e74c3c; font-size: 14px; margin-top: 15px;">
                  ⚠️ Please change your password after first login for security.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/login" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Login to Ctrl E
                </a>
              </div>
              
              <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="color: #2c5aa0; margin-top: 0;">Getting Started:</h4>
                <ul style="color: #2c5aa0; margin: 0;">
                  <li>Log in with the credentials above</li>
                  <li>View your assigned projects in the dashboard</li>
                  <li>Access client files via Google Drive integration</li>
                  <li>Upload edited versions and update project status</li>
                </ul>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you have any questions, please contact your administrator.
              </p>
            </div>
            
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 Ctrl E - Video Editing CRM</p>
              <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending editor credentials email:', error);
      throw new Error('Failed to send editor credentials email');
    }
  }

  /**
   * Send project completion notification to client
   */
  async sendProjectCompletionNotification(project) {
    try {
      if (!project.clientEmail) {
        console.log('No client email provided, skipping notification');
        return true;
      }

      const statusUrl = `${process.env.FRONTEND_URL}/project-status/${project.publicId}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: project.clientEmail,
        subject: 'Your Video Project is Ready - Ctrl E',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Ctrl E</h1>
              <p style="color: white; margin: 10px 0 0 0;">Your Video is Ready!</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${project.clientName},</h2>
              
              <p style="color: #666; line-height: 1.6;">
                Great news! Your video editing project has been completed and is ready for review.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Project Details:</h3>
                <p style="margin: 10px 0;"><strong>Project ID:</strong> ${project.publicId}</p>
                <p style="margin: 10px 0;"><strong>Description:</strong> ${project.description}</p>
                <p style="margin: 10px 0;"><strong>Status:</strong> <span style="color: #27ae60;">Completed</span></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${statusUrl}" 
                   style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View & Download Your Video
                </a>
              </div>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="color: #856404; margin: 0;">
                  <strong>What's Next?</strong><br>
                  Click the link above to review your completed video. You can either approve it or request revisions if needed.
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Thank you for choosing Ctrl E for your video editing needs!
              </p>
            </div>
            
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 Ctrl E - Video Editing CRM</p>
              <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending project completion email:', error);
      throw new Error('Failed to send project completion notification');
    }
  }

  /**
   * Send revision request notification to admin
   */
  async sendRevisionRequestNotification(project, feedback) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.log('No admin email configured');
        return true;
      }

      const dashboardUrl = `${process.env.FRONTEND_URL}/admin/dashboard`;

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: adminEmail,
        subject: `Revision Requested - Project ${project.publicId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Ctrl E - Admin Alert</h1>
              <p style="color: white; margin: 10px 0 0 0;">Revision Requested</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Revision Request</h2>
              
              <p style="color: #666; line-height: 1.6;">
                A client has requested revisions for their completed project.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Project Details:</h3>
                <p style="margin: 10px 0;"><strong>Project ID:</strong> ${project.publicId}</p>
                <p style="margin: 10px 0;"><strong>Client:</strong> ${project.clientName}</p>
                <p style="margin: 10px 0;"><strong>Phone:</strong> ${project.clientPhone}</p>
                <p style="margin: 10px 0;"><strong>Email:</strong> ${project.clientEmail || 'Not provided'}</p>
              </div>
              
              <div style="background: #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="color: #d63031; margin-top: 0;">Client Feedback:</h4>
                <p style="color: #2d3436; margin: 0; font-style: italic;">"${feedback}"</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" 
                   style="background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View in Admin Dashboard
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Please review the feedback and assign the project for revisions.
              </p>
            </div>
            
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 Ctrl E - Video Editing CRM</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending revision request email:', error);
      throw new Error('Failed to send revision request notification');
    }
  }

  /**
   * Send project assignment notification to editor
   */
  async sendProjectAssignmentNotification(editor, project) {
    try {
      const dashboardUrl = `${process.env.FRONTEND_URL}/editor/dashboard`;

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: editor.email,
        subject: `New Project Assigned - ${project.publicId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Ctrl E</h1>
              <p style="color: white; margin: 10px 0 0 0;">New Project Assigned</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${editor.name},</h2>
              
              <p style="color: #666; line-height: 1.6;">
                A new video editing project has been assigned to you.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Project Details:</h3>
                <p style="margin: 10px 0;"><strong>Project ID:</strong> ${project.publicId}</p>
                <p style="margin: 10px 0;"><strong>Client:</strong> ${project.clientName}</p>
                <p style="margin: 10px 0;"><strong>Description:</strong> ${project.description}</p>
                <p style="margin: 10px 0;"><strong>Priority:</strong> <span style="color: ${project.priority === 'high' ? '#e74c3c' : project.priority === 'medium' ? '#f39c12' : '#27ae60'};">${project.priority.toUpperCase()}</span></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Project
                </a>
              </div>
              
              <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #2c5aa0; margin: 0;">
                  <strong>Next Steps:</strong><br>
                  • Access the project files via Google Drive<br>
                  • Update project status as you work<br>
                  • Upload completed versions when ready
                </p>
              </div>
            </div>
            
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 Ctrl E - Video Editing CRM</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending project assignment email:', error);
      throw new Error('Failed to send project assignment notification');
    }
  }

  /**
   * Send general notification email
   */
  async sendNotification(to, subject, message) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Ctrl E</h1>
              <p style="color: white; margin: 10px 0 0 0;">Video Editing CRM Platform</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">${subject}</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #666; line-height: 1.6;">${message}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/login" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          display: inline-block;">
                  Login to Dashboard
                </a>
              </div>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} Ctrl E. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Notification email sent to ${to}`);
    } catch (error) {
      console.error('Error sending notification email:', error);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
