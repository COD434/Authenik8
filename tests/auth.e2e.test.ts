import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import sinon from "sinon";
import request from "supertest";
import app, {appReady} from "../script";
import {prisma} from "../prisma/config/validate";
import * as rabbitmq from "../prisma/config/Rabbitmq";

describe("authentication API end-to-end", function () {
  this.timeout(30000);

  const email = "e2e-user@example.com";
  const username = "e2e_user";
  const password = "StrongPassword1!";
  const newPassword = "NewStrongPassword2!";

  before(async () => {
    sinon.stub(rabbitmq, "publishToQueue").resolves();
    await appReady;
    await prisma.user.deleteMany();
  });

  after(() => {
    sinon.restore();
  });

  it("registers, logs in, resets the password, and logs in again", async () => {
    const registration = await request(app)
      .post("/register")
      .send({email, username, password});

    assert.equal(registration.status, 200);
    assert.equal(registration.body.success, true);

    const storedUser = await prisma.user.findUnique({where: {email}});
    assert.ok(storedUser);
    assert.notEqual(storedUser.password, password);
    assert.equal(await bcrypt.compare(password, storedUser.password), true);

    const login = await request(app)
      .post("/login")
      .send({email, password});

    assert.equal(login.status, 200);
    assert.equal(login.body.success, true);
    assert.ok(login.body.user.accessToken);
    assert.ok(login.body.user.refreshToken);
    assert.match(login.headers["set-cookie"][0], /HttpOnly/);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", login.headers["set-cookie"]);

    assert.equal(logout.status, 200);
    assert.equal(logout.body.success, true);

    const resetRequest = await request(app)
      .post("/request-password-reset")
      .send({email});

    assert.equal(resetRequest.status, 200);

    const resetUser = await prisma.user.findUnique({where: {email}});
    assert.ok(resetUser?.resetToken);

    const verification = await request(app)
      .post("/verify-reset-otp")
      .send({email, otp: resetUser.resetToken});

    assert.equal(verification.status, 200);

    const update = await request(app)
      .post("/update-password")
      .send({email, password: newPassword});

    assert.equal(update.status, 200);

    const secondLogin = await request(app)
      .post("/login")
      .send({email, password: newPassword});

    assert.equal(secondLogin.status, 200);
    assert.equal(secondLogin.body.user.email, email);
  });

  it("issues guest credentials and enforces the login rate limit", async () => {
    const guest = await request(app).get("/api/auth/guest-mode");
    assert.equal(guest.status, 200);
    assert.ok(guest.headers["x-guest-token"]);

    let blocked = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await request(app)
        .post("/login")
        .send({email, password: "WrongPassword1!"});
      if (response.status === 429) {
        blocked = true;
        break;
      }
    }

    assert.equal(blocked, true);

    const metrics = await request(app).get("/metrics");
    assert.match(metrics.text, /Login_Attempts_Blocked\s+[1-9]/);
    assert.match(metrics.text, /Guest_visited\{endpoint="\/api\/auth\/guest-mode"\}\s+[1-9]/);
  });
});
