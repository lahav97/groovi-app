class User {
    constructor({
      fullName,
      username,
      email,
      phoneNumber,
      password,
      userType,
      instruments,
      genres,
      location,
      videos,
      bio,
    }) {
      this.fullName = fullName;
      this.username = username;
      this.email = email;
      this.phoneNumber = phoneNumber;
      this.password = password;
      this.userType = userType;
      this.instruments = instruments;
      this.genres = genres;
      this.location = location;
      this.videos = videos;
      this.bio = bio;
    }
  }
  
  export default User;
  