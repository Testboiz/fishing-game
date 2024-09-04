<!-- @format -->

## Whats this?

TODO

- [ ] Add API documentation
- [ ] Add sample SqLite database
- [ ] Polish up README
- [ ] handle mistakes wrong HTTP method
- [ ] Add overrides of error handling (remove debug stack on common errors)

My attempt to recreate the backend of LGH Fish Hunt minigame from [Second Life](secondlife.com) in [Express.Js](https://github.com/expressjs/express)

I am inspired of the metaverse video game named Second Life, about how the players play the game and earn ingame currency, called Linden Dollars (L$) which can be used to buy in game stuff.

This repository is the recreation of the server side code of the [Linden Gold Hunters](goldtokens.net) game named [Fish Hunt](goldtokens.net/games/fish_hunt.php)

This is the game where players fish to get some great catches, One may get stuff ranging from normal fishes, to rare mythical fishes, or even just some random trash (oof!).

This backend API doesn't always has to be used only in Second Life though, This backend can be used in plenty of platforms like mobile games using HTTP requests.

## API Reference

Last Updated (4 September 2024)

### General Endpoints

There are only one endpoints for this category being the `/` endpoint, also with the 404 support.

```
GET /
```

Description : Returns the status of the server

Normally it should return this

```json
{
  "message": "Server is Up!",
  "status": 200
}
```

This API also supports 404 message if you entered the wrong endpoint. Here what would it give in response

```json
{
  "message": "You are accessing page that does not exist!",
  "status": 404
}
```

> Note. All the paramerers are **required** as of now, it can't be `null`, `undefined` or NaN

As of now, the general error message would be in this form

```json
{
  "message": "the database blew up",
  "status": 500,
  "debugMsg": "error message here",
  "debugStack": "debug stack for extra debugging info"
}
```

### Rod Interactions

Handles interactions about quthentication in `/rod/auth`, registering in `/rod/register` and adding worms in `/rod/add-worms`

```
GET /rod/auth
```

| Parameter     | Type          | Description                                              |
| ------------- | ------------- | -------------------------------------------------------- |
| `rod_uuid`    | string (UUID) | The uuid of the rod                                      |
| `player_uuid` | string (UUID) | The uuid of the player (for registering/updating player) |

> Note. This call must be done at the time when the player is logged in and rod is equipped

This authentication is crucial, because it would prevent breach of information from a player to another. Also this authentication is important to handle integrity of the data.

If the rod and player is registered in the database, then this message would be received

```json
{
  "message": "Authorization Successful",
  "status": 200
}
```

Otherwise, if the rod and player combination is incorrect, then this error message would be received

```json
{
  "message": "Authorization Failed, Rod cannot be transferred to another player",
  "status": 200
}
```

```
POST /rod/register
```

Parameters :

| Parameter             | Type          | Description                                                   |
| --------------------- | ------------- | ------------------------------------------------------------- |
| `rod_uuid`            | string (UUID) | The uuid of the rod                                           |
| `player_uuid`         | string (UUID) | The uuid of the player (for registering/updating player)      |
| `player_username`     | string        | The unique username of the player, for in game identification |
| `player_display_name` | string        | The display name of a player, for customization purposes      |
| `rod_type`            | string (Enum) | The type of the rod, in numbers                               |

Here are the possible values of `rod_type` and their names and base XP.

| `rod_type` | Rod Name        | Base XP |
| ---------- | --------------- | ------- |
| 1          | Beginner Rod    | 1       |
| 2          | Pro Rod         | 2       |
| 3          | Enchanted Rod   | 4       |
| 4          | Magic Rod       | 8       |
| 5          | Magic Shark Rod | 8       |
| 6          | Competitive 1   | 10      |
| 7          | Competitive 2   | 12      |

The successful message would be like this

```json
{
  "message": "Player and rod registered with free 100 Small Worms",
  "status": 200
}
```

There is a specific error when player is registered for this endpoint which would be like this

```json
{
  "message": "Rod is already registered",
  "status": 409
}
```

```
POST /rod/add-worms
```

Parameters :

| Parameter      | Type                   | Description              |
| -------------- | ---------------------- | ------------------------ |
| `rod_uuid`     | string (UUID)          | The uuid of the rod      |
| `worm_amnount` | number                 | The amnount of the worms |
| `worm_type`    | string (set of values) | The type of the worms    |

The possible values of the `worm_type` is `"small_worms"`, `"tasty_worms"`, `"enchanted_worms"`, and `"magic_worms"`.
The result would be in this form, with the request with `worm_amnount` being 10, and `worm_type` being `small_worms`

```json
{
  "message": {
    "text": "You have bought 10 Small Worms!",
    "wormCount": 10
  },
  "status": 200
}
```

There is a specific error when worm_amnount is filed incorrectly, it would give this error message

TODO > override error message to this form

```json
{
  "message": "Invalid Worm Type",
  "status": 409
}
```

### Buoy Interactions

### Player Interactions
