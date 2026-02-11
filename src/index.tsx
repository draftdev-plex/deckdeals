import {
  definePlugin,
  ServerAPI,
  staticClasses,
} from "decky-frontend-lib";
import { FaChartLine } from "react-icons/fa";

import DeckyMenuOption from "./components/DeckyMenuOption";
import { injectStore } from "./patches/StoreInjector";
import { Cache } from "./utils/Cache";
import { Settings } from "./utils/Settings";
import { priceService } from "./service/PriceService";


export default definePlugin((serverApi: ServerAPI) => {


  Cache.init()
  Settings.init(serverApi)
  priceService.init(serverApi)

  // injectStore returns a teardown function
  const stopStoreInjector = injectStore(serverApi)


  return {
    title: <div className={staticClasses.Title}>Deckdeals</div>,
    content: <DeckyMenuOption />,
    icon: <FaChartLine />,
    onDismount() {
      stopStoreInjector()
    },
  };
});
