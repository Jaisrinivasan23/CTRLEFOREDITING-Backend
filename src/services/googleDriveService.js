const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name, parentFolderId = null) {
    try {
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [process.env.GOOGLE_DRIVE_FOLDER_ID]
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      return {
        id: folder.data.id,
        name: folder.data.name,
        webViewLink: folder.data.webViewLink
      };
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error('Failed to create folder in Google Drive');
    }
  }

  /**
   * Create client project folder structure
   */
  async createClientProjectStructure(clientName, projectId) {
    try {
      // Create main project folder
      const mainFolder = await this.createFolder(`${clientName} - ${projectId}`);
      
      // Create subfolders
      const clientUploadFolder = await this.createFolder('Client Uploaded', mainFolder.id);
      const voiceFilesFolder = await this.createFolder('Voice Files', mainFolder.id);
      const voiceMessagesFolder = await this.createFolder('Voice Messages', mainFolder.id);
      const editedVersionsFolder = await this.createFolder('Edited Versions', mainFolder.id);

      return {
        mainFolder,
        clientUploadFolder,
        voiceFilesFolder,
        voiceMessagesFolder,
        editedVersionsFolder
      };
    } catch (error) {
      console.error('Error creating client project structure:', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive from buffer (no local storage)
   */
  async uploadFileFromBuffer(buffer, fileName, folderId, mimeType = null) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: buffer
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, size'
      });

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        downloadLink: `https://drive.google.com/uc?id=${file.data.id}`,
        size: file.data.size
      };
    } catch (error) {
      console.error('Error uploading buffer to Google Drive:', error);
      throw new Error('Failed to upload file buffer to Google Drive');
    }
  }

  /**
   * Upload file to Google Drive (backward compatibility)
   */
  async uploadFile(filePath, fileName, folderId, mimeType = null) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: fs.createReadStream(filePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, size'
      });

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        size: file.data.size
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file to Google Drive');
    }
  }

  /**
   * Create version folder and upload edited video
   */
  async uploadEditedVersion(filePath, fileName, projectFolderId, version) {
    try {
      // Find or create the "Edited Versions" folder
      const editedVersionsFolder = await this.findOrCreateEditedVersionsFolder(projectFolderId);
      
      // Create version folder (v1, v2, etc.)
      const versionFolder = await this.createFolder(`v${version}`, editedVersionsFolder.id);
      
      // Upload the edited video to the version folder
      const uploadedFile = await this.uploadFile(filePath, fileName, versionFolder.id);

      return {
        versionFolder,
        uploadedFile
      };
    } catch (error) {
      console.error('Error uploading edited version:', error);
      throw error;
    }
  }

  /**
   * Create version folder and upload edited video FROM BUFFER (MEMORY STORAGE)
   */
  async uploadEditedVersionFromBuffer(buffer, fileName, projectFolderId, version) {
    try {
      // Find or create the "Edited Versions" folder
      const editedVersionsFolder = await this.findOrCreateEditedVersionsFolder(projectFolderId);
      
      // Create version folder (v1, v2, etc.)
      const versionFolder = await this.createFolder(`v${version}`, editedVersionsFolder.id);
      
      // Upload the edited video to the version folder from buffer
      const uploadedFile = await this.uploadFileFromBuffer(buffer, fileName, versionFolder.id);

      return {
        versionFolder,
        uploadedFile
      };
    } catch (error) {
      console.error('Error uploading edited version from buffer:', error);
      throw error;
    }
  }

  /**
   * Find or create Edited Versions folder
   */
  async findOrCreateEditedVersionsFolder(parentFolderId) {
    try {
      // Search for existing "Edited Versions" folder
      const query = `name='Edited Versions' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder'`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0];
      }

      // Create if doesn't exist
      return await this.createFolder('Edited Versions', parentFolderId);
    } catch (error) {
      console.error('Error finding/creating edited versions folder:', error);
      throw error;
    }
  }

  /**
   * Grant editor access to specific folder
   */
  async grantEditorAccess(folderId, editorEmail) {
    try {
      const permission = {
        role: 'writer',
        type: 'user',
        emailAddress: editorEmail
      };

      await this.drive.permissions.create({
        fileId: folderId,
        resource: permission,
        sendNotificationEmail: true,
        emailMessage: 'You have been granted access to work on this project folder.'
      });

      return true;
    } catch (error) {
      console.error('Error granting editor access:', error);
      throw new Error('Failed to grant editor access to folder');
    }
  }

  /**
   * Revoke editor access from folder
   */
  async revokeEditorAccess(folderId, editorEmail) {
    try {
      // Get list of permissions
      const permissions = await this.drive.permissions.list({
        fileId: folderId,
        fields: 'permissions(id, emailAddress, role)'
      });

      // Find the editor's permission
      const editorPermission = permissions.data.permissions.find(
        p => p.emailAddress === editorEmail && p.role === 'writer'
      );

      if (editorPermission) {
        await this.drive.permissions.delete({
          fileId: folderId,
          permissionId: editorPermission.id
        });
      }

      return true;
    } catch (error) {
      console.error('Error revoking editor access:', error);
      throw new Error('Failed to revoke editor access from folder');
    }
  }

  /**
   * Get file download URL
   */
  async getFileDownloadUrl(fileId) {
    try {
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'webContentLink, webViewLink'
      });

      return {
        downloadUrl: file.data.webContentLink,
        viewUrl: file.data.webViewLink
      };
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw new Error('Failed to get file download URL');
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({
        fileId: fileId
      });
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file from Google Drive');
    }
  }

  /**
   * List files in folder
   */
  async listFilesInFolder(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `parents in '${folderId}'`,
        fields: 'files(id, name, size, createdTime, mimeType, webViewLink)',
        orderBy: 'createdTime desc'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error('Failed to list files in folder');
    }
  }

  /**
   * Get folder info
   */
  async getFolderInfo(folderId) {
    try {
      const folder = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime'
      });

      return folder.data;
    } catch (error) {
      console.error('Error getting folder info:', error);
      throw new Error('Failed to get folder information');
    }
  }

  /**
   * Upload voice message from buffer (no local storage)
   */
  async uploadVoiceMessageFromBuffer(buffer, fileName, folderId) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'audio/webm', // Common format for web audio recordings
        body: buffer
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, size'
      });

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: file.data.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get direct download link
      const downloadLink = `https://drive.google.com/uc?id=${file.data.id}`;

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        downloadLink: downloadLink,
        size: file.data.size
      };
    } catch (error) {
      console.error('Error uploading voice message buffer:', error);
      throw new Error('Failed to upload voice message buffer to Google Drive');
    }
  }

  /**
   * Upload voice message to Google Drive (backward compatibility)
   */
  async uploadVoiceMessage(filePath, fileName, folderId) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'audio/webm', // Common format for web audio recordings
        body: fs.createReadStream(filePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, size'
      });

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: file.data.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get direct download link
      const downloadLink = `https://drive.google.com/uc?id=${file.data.id}`;

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        downloadLink: downloadLink,
        size: file.data.size
      };
    } catch (error) {
      console.error('Error uploading voice message:', error);
      throw new Error('Failed to upload voice message to Google Drive');
    }
  }
}

module.exports = new GoogleDriveService();
