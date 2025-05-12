import User from '../models/User.js';

class UserBuilder {
    constructor() {
        this.user = {};
    }

    setFullName(fullName) {
        this.user.fullName = fullName;
        return this;
    }

    setUsername(username) {
        this.user.username = username;
        return this;
    }

    setProfilePicture(profilePicture) {
        this.user.profilePicture = profilePicture;
        return this;
    }
    
    setGender(gender) {
        this.user.gender = gender;
        return this;
    }

    setEmail(email) {
        this.user.email = email;
        return this;
    }

    setPhoneNumber(phoneNumber) {
        this.user.phoneNumber = phoneNumber;
        return this;
    }

    setPassword(password) {
        this.user.password = password;
        return this;
    }

    setUserType(userType) {
        this.user.userType = userType;
        return this;
    }

    setInstruments(instruments) {
        this.user.instruments = instruments;
        return this;
    }

    setGenres(genres) {
        this.user.genres = genres;
        return this;
    }
    setLocation(location) {
        this.user.location = location;
        return this;
    }
    
    setVideos(videos) {
        this.user.videos = videos;
        return this;
    }

    setBio(bio) {
        this.user.bio = bio;
        return this;
    }

    build() {
        return new User(this.user);
    }

    clear() {
        this.user = {};
        return this;
    }
}


export default UserBuilder;
