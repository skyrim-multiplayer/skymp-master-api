import { TestUtilsProvider } from "../../src/utils/testUtils";
import { getMyPublicIp } from "../../src/utils/publicIp";
import {
  LegacyController,
  defaultStatsUpdateRate
} from "../../src/v1/legacyController";

beforeEach(TestUtilsProvider.beforeEach);
afterEach(TestUtilsProvider.afterEach);

describe("Legacy routes", () => {
  it("should return correct statistics", async () => {
    const { getStats } = TestUtilsProvider;
    const res = await getStats();

    expect(
      res.findIndex(
        (x) =>
          x.PlayersOnline === "0" &&
          x.ServersOnline === "1" &&
          x.Time === "2020/07/14 12:06:03"
      )
    ).toEqual(0);
    expect(
      res.findIndex(
        (x) =>
          x.PlayersOnline === "3" &&
          x.ServersOnline === "1" &&
          x.Time === "2020/09/11 22:07:17"
      )
    ).toEqual(83108);
  });

  it("should update stats when servers update their data", async () => {
    const { getStats, api } = TestUtilsProvider;
    const myIp = await getMyPublicIp();
    const was = (await getStats()).length;

    await api.post(`/servers/${myIp}:7777`, {
      name: "MyServer",
      maxPlayers: "30",
      online: "1"
    });

    const now = (await getStats()).length;

    expect(now - was).toEqual(1);

    const st = await getStats();
    expect(st[st.length - 1].PlayersOnline).toEqual("1");
    expect(st[st.length - 1].ServersOnline).toEqual("1");

    const after = (await getStats()).length;
    expect(after).toEqual(now);
  });

  it("should add stats element only when some time passed", async () => {
    const { getStats, api } = TestUtilsProvider;
    const myIp = await getMyPublicIp();

    for (let i = 0; i < 5; ++i) {
      await api.post(`/servers/${myIp}:7777`, {
        name: "MyServer",
        maxPlayers: "30",
        online: "30"
      });
      await api.get("/stats");
    }

    {
      const st = await getStats();
      expect(st[st.length - 1].PlayersOnline).toEqual("30");
      expect(st[st.length - 1].ServersOnline).toEqual("1");
      expect(st[st.length - 2].PlayersOnline).toEqual("2");
      expect(st[st.length - 2].ServersOnline).toEqual("2");
    }

    LegacyController.statsUpdateRate = 0;

    await api.post(`/servers/${myIp}:7777`, {
      name: "MyServer",
      maxPlayers: "30",
      online: "30"
    });
    const st = await getStats();

    expect(st[st.length - 1].PlayersOnline).toEqual("30");
    expect(st[st.length - 1].ServersOnline).toEqual("1");
    expect(st[st.length - 2].PlayersOnline).toEqual("30");
    expect(st[st.length - 2].ServersOnline).toEqual("1");
    expect(st[st.length - 3].PlayersOnline).toEqual("2");
    expect(st[st.length - 3].ServersOnline).toEqual("2");

    LegacyController.statsUpdateRate = defaultStatsUpdateRate;
  });
});
