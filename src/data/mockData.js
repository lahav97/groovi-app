// Mock video data
export const VIDEOS = [
  {
    id: '1',
    user: 'Lahav_Rabinovitz',
    description: 'Guitar, Drums 🔥',
    likes: 100,
    comments: 234,
    videoUrl: 'https://groovitest.s3.us-east-1.amazonaws.com/WhatsApp%20Video%202025-04-05%20at%2020.42.42.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAQ3EGVA66EJEDFBK3%2F20250405%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250405T174752Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELr%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIH2cwuli7fZGMU3pWx3qZpdtvT9cr5dWqe57kzY3%2B5azAiEAn65QtKjNUov71VOHn6NwqN9rFs08sRcAi6vCK26JVI0q8QIIMxAAGgwwNTgyNjQ0NTUxMDAiDL2byRYzmNthifAjGyrOAhsysaqoYxOXf2Y0hLfeK3JQ1wN0eGX0Ek0RoWcoqACyFraZ0fIM5iIlwQtI9Y0R1TXUELHU5y9d0JX4TnKBfIpXWYBDVflkHq1d3LJyV99BmqmSZ86MsFXLsm3g%2B2lsAUZkR1NLmwVJ0JQ0E78X2nHNyzF1LQP4%2FivdRO6IwMa11APZ9fWM1J9DF1b8KP0OuNbohLfhCwA7oCn%2BqK2IFODX2Q47TyE3W%2BiLCfAemh7EoedJondiqvUOakQaDXaj6KpZFeLbIaMijlJNReDvjl5JYoZSCBO8FJad5gNte8%2FGTjHIZ0p9FcYgTqGmFeRZqqd%2F%2FzeP%2B5nmzu1Me3FzGhwZWZ8o9B614JZ2%2BXRYvduZxQeU%2F2gF3oYMI6KLymnVAOMzkKjpoFx5WWCfxQVoPQABFFzLn398eq3l6qGw7T0KTVpdk7WUzCzAMSobJ1gw0rvFvwY6hwJQt70FyBRcSnWkwFXl1oQ5MOUhBc%2BJP5aSFRNvpvHftlXA7TmiTONhKr8ws1goT96tXmxq2NEe4r5T2%2BAMwP6pP8KIPxTQmggddPBPSmTOXsnA9MkovufQ4ZPePSyHQgwCHAcRs0I17hBiFM0YNfP9Udwcgd4tMcU5IlUH3InoKWvYYC03Fd0Wu0mgH81RTMPb3rcJ88ju315cN955zyYY8FmykL2EQ6bFsziLVd9SsuyUfKoZRbJAhvMy%2FcyMZQKZRxTq4z8s4UoGuQEnVHnwDOxtnSqTzr%2FXAt37143B4fW0%2BUk3vknYAscx5BAqzUVEqttnuSPY3jgQhHeT54JtF0vh6nl51A%3D%3D&X-Amz-Signature=2849a9ea504d1a669107edf6ebe73c26c42e2b859b2c49e6beb532d9fd0b43c3&X-Amz-SignedHeaders=host&response-content-disposition=inline', // Example video URL
  },
  {
    id: '2',
    user: 'Shay.Paz',
    description: 'Sing 🌄',
    likes: 50,
    comments: 105,
    videoUrl: 'https://groovitest.s3.us-east-1.amazonaws.com/WhatsApp%20Video%202025-04-05%20at%2020.44.38.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAQ3EGVA66DGJOPOUY%2F20250405%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250405T174758Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELr%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJGMEQCIHZSvh1yd8DQce69LNOpMSAyyTPfSbOBaQrSFYQN5gfkAiAc4DYb42dfyNzh0K5TvC9%2BE0aDSpnoSFqN0PrCyzdMVirxAggzEAAaDDA1ODI2NDQ1NTEwMCIMTIBBycYotDIH1sQlKs4CXNQOjP1spq2cIOSbscikHWiek39PdQwPdj0GasVxdVp9qHGsrdH%2FSY%2BSxUiDeCu%2Fvpx4%2BBcSAHMag4dcu6OANoLGC9xbU0Q%2BWmnfUqKAShtrHHshZT6%2BPoTkCCC6e4TWgDHGLYgdjGt5pKpKaLLdfmECz6uRz7ALJn54wutSwHWjOIZNy2p8ZX5IvhA5Ks2d1MSE28Q4x5EGu1lncl7z77phTt%2FBjYuWTg47T%2BSalGnD43E1nvDe%2FgEAj0PWVPAMnt9bMtOhvIgSDhwllgClZQwkbh38v4lc8V5u0d7JNuCfohoOD5RI2PnsIDXEkjk7uMQX8I4Feo%2BKz7d%2Frpba286trpFcEiqi7PX%2FyAcMu3a%2F65fKjKLeRtVHw%2Fdlf3r0Bvp285ASr6dhC9hthKlMz5yhkTN8WyLCWXR9h%2BxHdvi4OsOs8hqiTucaIz9sczDSu8W%2FBjqIAkIT4vCRA67Fiyd9Ujj%2BGiaV7addtWg9mXzyhV1Yba7HI4Y5bYtaf65d2ncdQSXpZG4oLR3W3rct0EApxDO1iYQ00BSc6yP2q507p1K7EBgX1jG%2F%2FP9YPm%2FV8IAsfP4eeyg2zkNBvcllXboTrfmjKc3lPFRhSaCGzOp39S6fI%2B%2B9SN5sPHF3H4CgfWmBr%2ByHT1FveE4Ig4vwPpvSqIYOA%2BPIZ3Rue8GS9j6K4ZVyNYC98ou%2B1iw1mbyDI095jsLbDkd1CWPKcLaxQSOaUEBt9C45LygCvhhs%2Bzpz55daVwKGCJ7eGn%2ByMbhwysOsmVDsJXJZqAGk3nHy5nsL%2F%2Bz3j1T33xFVMwm29w%3D%3D&X-Amz-Signature=36025c8763f4f55f29a7b258779e175b14ef6bc95ed92497f9684f57c24c1fd0&X-Amz-SignedHeaders=host&response-content-disposition=inline', // Example video URL
  },
  {
    id: '3',
    user: 'Eyaloss',
    description: 'Piano, Guitar 💃🏻',
    likes: 14300,
    comments: 1200,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Example video URL
  },
  {
    id: '4',
    user: 'Ben_Lulu82',
    description: 'Bass 🍔',
    likes: 87,
    comments: 432,
    videoUrl: 'https://www.w3schools.com/html/movie.mp4', // Example video URL
  },
];