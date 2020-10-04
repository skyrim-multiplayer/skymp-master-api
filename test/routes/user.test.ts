import { TestUtilsProvider } from "../../src/utils/testUtils";
import { User, Roles, VERIFICATION_EXPIRES } from "../../src/models/user";

beforeEach(TestUtilsProvider.beforeEach);
afterEach(TestUtilsProvider.afterEach);

const loginAsTestUser = async (
  user: User,
  password = "jejeje"
): Promise<string> => {
  const { api } = TestUtilsProvider;
  const res = await api.post("/users/login", {
    email: user.email,
    password
  });
  return res.data.token as string;
};

describe("User system", () => {
  it("should be able to create a new account", async () => {
    const { users, api } = TestUtilsProvider;
    expect(await users.count({})).toEqual(0);

    const res = await api.post("/users", {
      name: "GeneralEasterEgg",
      email: "bar@example.com",
      password: "no-clientside-hashing-plz"
    });
    expect(res.status).toEqual(201);
    expect(typeof res.data.id).toEqual("number");

    expect(await users.count({})).toEqual(1);

    const user = await users.findOne({ name: "GeneralEasterEgg" });
    expect(user).not.toBeFalsy();
    if (user) {
      expect(user.verificationPin.length).toEqual(32);

      expect(Math.abs(Date.now() - +user.verificationPinSentAt)).toBeLessThan(
        1000
      );

      expect(user.hasVerifiedEmail).toBeFalsy();
    }
  });

  it("should fail to login with bad credentials", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    await createTestUser({ hasVerifiedEmail: true });

    await expect(api.post("/users/login", {})).rejects.toThrowError(
      "Request failed with status code 401"
    );
    await expect(
      api.post("/users/login", {
        email: "lelele@test.be",
        password: "ddddasdasd"
      })
    ).rejects.toThrowError("Request failed with status code 401");
  });

  it("should be able to login into an existing account", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    await createTestUser({ hasVerifiedEmail: true });

    const res = await api.post("/users/login", {
      email: "lelele@test.be",
      password: "jejeje"
    });
    expect(Object.keys(res.data)).toEqual(["token", "id", "name"]);
    expect(`${res.data.token}`).toMatch(/JWT\s.*/);
    expect(res.data.name).toEqual("igor");
    expect(typeof res.data.id).toBe("number");
  });

  it("should be able to use admin-only routes with admin access", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser({
      hasVerifiedEmail: true,
      roles: [Roles.admin]
    });
    const token = await loginAsTestUser(user);

    const res = await api.get("/secure/admin", {
      headers: { Authorization: token }
    });
    expect(res.data).toEqual("SECURE ROUTE");
  });

  it("should fail to use admin-only routes without access", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser({
      hasVerifiedEmail: true,
      roles: []
    });
    const token = await loginAsTestUser(user);

    await expect(
      api.get("/secure/admin", { headers: { Authorization: token } })
    ).rejects.toThrowError("Request failed with status code 403");
  });

  it("should throw 404 when trying to verify email of unexisting user", async () => {
    const { api } = TestUtilsProvider;
    for (const id in ["yay", "1000000000", "-1"])
      await expect(api.post(`/users/${id}/verify`, {})).rejects.toThrowError(
        "Request failed with status code 404"
      );
  });

  it("should throw 404 when trying to verify email using bad PIN", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    await expect(
      api.post(`/users/${user.id}/verify`, {
        pin: "BAD_PIN",
        password: "jejeje",
        email: "lelele@test.be"
      })
    ).rejects.toThrowError("Request failed with status code 404");
  });

  it("should throw 404 when trying to verify email using bad PASSWORD", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    await expect(
      api.post(`/users/${user.id}/verify`, {
        pin: "qwerty",
        password: "BAD_PASS",
        email: "lelele@test.be"
      })
    ).rejects.toThrowError("Request failed with status code 404");
  });

  it("should throw 404 when trying to verify email using bad EMAIL", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    await expect(
      api.post(`/users/${user.id}/verify`, {
        pin: "qwerty",
        password: "jejeje",
        email: "BAD_EMAIL"
      })
    ).rejects.toThrowError("Request failed with status code 404");
  });

  it("should throw 404 when trying to verify email when email is already verified", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser({ hasVerifiedEmail: true });
    await expect(
      api.post(`/users/${user.id}/verify`, {
        pin: "qwerty",
        password: "jejeje",
        email: "lelele@test.be"
      })
    ).rejects.toThrowError("Request failed with status code 404");
  });

  it("should be able to verify user's email", async () => {
    const { users, api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();

    expect(await users.count({ hasVerifiedEmail: true })).toEqual(0);

    const res = await api.post(`/users/${user.id}/verify`, {
      pin: "qwerty",
      password: "jejeje",
      email: "lelele@test.be"
    });
    expect(res.status).toEqual(200);
    expect(`${res.data.token}`).toMatch(/JWT\s.*/);
    expect(await users.count({ hasVerifiedEmail: true })).toEqual(1);
  });

  it("should be able to change user's password", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser({ hasVerifiedEmail: true });

    await loginAsTestUser(user, "jejeje");
    await expect(loginAsTestUser(user, "lolkek")).rejects.toThrow();

    const res = await api.post(`/users/${user.id}/reset-password`, {
      password: "jejeje",
      email: "lelele@test.be",
      newPassword: "lolkek"
    });

    expect(res.data["passwordGenerated"]).toEqual(false);
    await expect(loginAsTestUser(user, "jejeje")).rejects.toThrow();
    await loginAsTestUser(user, "lolkek");
  });

  it("should be able to reset user's password", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser({ hasVerifiedEmail: true });

    await loginAsTestUser(user, "jejeje");
    await expect(loginAsTestUser(user, "lolkek")).rejects.toThrow();

    const res = await api.post(`/users/${user.id}/reset-password`, {
      password: "jejeje",
      email: "lelele@test.be"
    });

    expect(res.data["passwordGenerated"]).toEqual(true);
    await expect(loginAsTestUser(user, "jejeje")).rejects.toThrow();
  });

  it("should fail to create accounts with same emails", async () => {
    const { users, api } = TestUtilsProvider;
    expect(await users.count({})).toEqual(0);
    const res = await api.post("/users", {
      name: "GeneralEasterEgg",
      email: "bar@example.com",
      password: "no-clientside-hashing-plz"
    });
    expect(res.status).toEqual(201);

    expect(await users.count({})).toEqual(1);

    await expect(
      api.post("/users", {
        name: "Inferno",
        email: "bar@example.com",
        password: "asdasdz"
      })
    ).rejects.toThrow();
    expect(await users.count({})).toEqual(1);
  });

  it("should be able to recreate pin when valid input data", async () => {
    const { users, api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    const prevPin = user.verificationPin;

    const res = await api.post(`/users/${user.id}/reset-pin`, {
      email: user.email,
      password: "jejeje"
    });
    expect(res.status).toEqual(200);
    expect(await users.count({ verificationPin: prevPin })).toEqual(0);

    const updatedUser = await users.findOne({ id: user.id });
    expect(updatedUser).not.toBeFalsy();
    if (updatedUser) {
      expect(
        await users.count({
          verificationPin: updatedUser.verificationPin
        })
      ).toEqual(1);
    }
  });

  it("should fail to reset pin with same input data", async () => {
    const { api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();

    await expect(
      api.post(`/users/${user.id}/reset-pin`, {
        email: user.email,
        password: "BAD_PASSWORD"
      })
    ).rejects.toThrow();
  });

  it("should fail to reset pin for user has verified email", async () => {
    const { users, api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    user.hasVerifiedEmail = true;

    await users.save(user);

    await expect(
      api.post(`/users/${user.id}/reset-pin`, {
        email: user.email,
        password: "jejeje"
      })
    ).rejects.toThrow();
  });

  it("should fail to reset pin when code is expired", async () => {
    const { users, api, createTestUser } = TestUtilsProvider;
    const { user } = await createTestUser();
    user.verificationPinSentAt = new Date(
      new Date().getTime() - VERIFICATION_EXPIRES - 1000
    );

    await users.save(user);

    await expect(
      api.post(`/users/${user.id}/reset-pin`, {
        email: user.email,
        password: "jejeje"
      })
    ).rejects.toThrow();
  });
});
