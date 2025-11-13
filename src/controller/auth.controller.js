import {
  register as registerService,
  verifyFirebaseToken as loginService,
  logout as logoutService
} from '../service/auth-service.js'

export const login = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await loginService(token);
    res.status(200).json({ message: 'Ruta protegida accedida con éxito', user });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

export const register = async (req, res) => {
  try {
    const { name, lastname, email, password } = req.body;
    const user = await registerService(name, lastname, email, password);
    res.status(201).json(user);
  } catch (error) {
    console.log("Este es el error desde el controlador", error.code);
    if (error.code == 'auth/email-already-exists') {
      res.status(400).json({ message: 'El correo electrónico ya está en uso' });
    } else {
      res.status(500).json({ message: 'Error al registrar el usuario', error: error.message });
    }
  }
};


export const logout = async (req, res) => {
  const { uid } = req.body

  if (!uid) {
    return res.status(400).json({ message: 'UID no proporcionado' });
  }
  try {
    const result = await logoutService(uid);
    res.status(200).json(result);
  } catch (error) {
    console.log("Paso el error")
    res.status(500).json({ message: error.message });
  }
}
