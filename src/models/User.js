class User {
    constructor({
      fullName,
      username,
      gender,
      email,
      phoneNumber,
      password,
      userType,
      instruments,
      genres,
      location,
      videos,
      profilePicture,
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
      this.gender = gender;
      this.location = location;
      this.videos = videos;
      this.bio = bio;
      this.profilePicture = profilePicture;
    }
  }
  
  export default User;
  