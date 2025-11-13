class User {
    constructor(uid, name, lastname, email, role, createdAt) {
      this.uid = uid;
      this.name = name;
      this.lastname = lastname;
      this.email = email;
      this.role = role || 'user';
      this.createdAt = createdAt || new Date();
    }
  }
  
  export default User;
  