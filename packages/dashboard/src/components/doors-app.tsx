import { BuildingMap } from 'api-client';
import React from 'react';
import { DoorDataGridTable, DoorTableData } from 'react-components';
import { DoorMode as RmfDoorMode } from 'rmf-models/ros/rmf_door_msgs/msg/DoorMode';
import { throttleTime } from 'rxjs';

import { AppEvents } from './app-events';
import { createMicroApp } from './micro-app';
import { RmfAppContext } from './rmf-app';
import { getApiErrorMessage } from './utils';

export const DoorsApp = createMicroApp('Doors', () => {
  const rmf = React.useContext(RmfAppContext);
  const [buildingMap, setBuildingMap] = React.useState<BuildingMap | null>(null);
  const [doorTableData, setDoorTableData] = React.useState<Record<string, DoorTableData>>({});

  React.useEffect(() => {
    if (!rmf) {
      return;
    }
    const sub = rmf.buildingMapObs.subscribe(setBuildingMap);
    return () => sub.unsubscribe();
  }, [rmf]);

  React.useEffect(() => {
    if (!rmf) {
      return;
    }

    let doorIndex = 0;
    buildingMap?.levels.map((level) =>
      level.doors.map(async (door) => {
        try {
          const sub = rmf
            .getDoorStateObs(door.name)
            .pipe(throttleTime(3000, undefined, { leading: true, trailing: true }))
            .subscribe((doorState) => {
              setDoorTableData((prev) => {
                return {
                  ...prev,
                  [door.name]: {
                    index: doorIndex++,
                    doorName: door.name,
                    levelName: level.name,
                    doorType: door.door_type,
                    doorState: doorState,
                    onClickOpen: () =>
                      rmf?.doorsApi.postDoorRequestDoorsDoorNameRequestPost(door.name, {
                        mode: RmfDoorMode.MODE_OPEN,
                      }),
                    onClickClose: () =>
                      rmf?.doorsApi.postDoorRequestDoorsDoorNameRequestPost(door.name, {
                        mode: RmfDoorMode.MODE_CLOSED,
                      }),
                  },
                };
              });
            });
          return () => sub.unsubscribe();
        } catch (error) {
          console.error(`Failed to get lift health: ${getApiErrorMessage(error)}`);
        }
      }),
    );
  }, [rmf, buildingMap]);

  return (
    <DoorDataGridTable
      doors={Object.values(doorTableData)}
      onDoorClick={(_ev, doorData) => {
        if (!buildingMap) {
          AppEvents.doorSelect.next(null);
          return;
        }

        for (const level of buildingMap.levels) {
          for (const door of level.doors) {
            if (door.name === doorData.doorName) {
              AppEvents.doorSelect.next([level.name, door]);
              return;
            }
          }
        }
      }}
    />
  );
});
