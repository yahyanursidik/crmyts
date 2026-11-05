import { Router } from "../../http/router";
import { registerRoomPublicRoutes } from "./publicRoutes";
import { registerRoomManagementRoutes } from "./managementRoutes";
export {
  ROOM_CATEGORIES,
  ROOM_STATUSES,
  roomSubmissionSchema,
  parseRoomDate,
  containsContactDetail,
} from "./policy";
export function registerJamaahRoomRoutes(router: Router) {
  registerRoomPublicRoutes(router);
  registerRoomManagementRoutes(router);
}
