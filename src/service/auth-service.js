import admin from "firebase-admin"
import db from "../server.js"
import User from "../models/user.model.js"
import Roles from "../models/roles.js"

export const register = async (name, lastname, email, password) => {
  try {
    let userExists = false;
    try {
      await admin.auth().getUserByEmail(email);
      userExists = true;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        throw err; 
      }
    }

    if (userExists) {
      const error = new Error('El correo electrónico ya está en uso');
      error.code = 'auth/email-already-exists';
      throw error;
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    const user = new User(
      userRecord.uid,
      name,
      lastname,
      email,
      Roles.USER 
    );

    await db.collection('users').doc(userRecord.uid).set({ 
      ...user,
      createdAt: new Date().toISOString() // 🛠 ADD THIS
    });

    return user;

  } catch (error) {
    console.log("Error desde registerService:", error.code);
    throw error;
  }
};

export const verifyFirebaseToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email } = decodedToken;

    // Ensure user exists in Firestore
    const name = decodedToken.name || "";
    const lastname = ""; // optional if you want to split displayName
    await ensureUserInFirestore(uid, name, lastname, email || "");

    // Fetch user data from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new Error('User not found in Firestore');
    }
    const userData = userDoc.data();

    // Return merged info
    return {
      uid,
      email,
      name: userData.name,
      lastname: userData.lastname,
      role: userData.role || 'user', // default if role somehow missing
      createdAt: userData.createdAt,
    };

  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
};



export const logout = async (uid) => {
  try {
    await admin.auth().revokeRefreshTokens(uid);
    return { message: 'Sesión cerrada con éxito' };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw new Error('Error al cerrar sesión');
  }
}

const ensureUserInFirestore = async (uid, name, lastname, email) => {
  const userDocRef = db.collection('users').doc(uid);
  const userSnapshot = await userDocRef.get();

  if (!userSnapshot.exists) {
    await userDocRef.set({
      uid,
      name,
      lastname,
      email,
      role: 'user',
      createdAt: new Date().toISOString() // 🛠 Make it ISO String
    });
  }
};
