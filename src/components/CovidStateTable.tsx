"use client";

import stateMappersGermany from "@/app/helpers";
import { COVID_STATES_RELATION, getCovidStateMapId } from "@/app/covidStates";
import { useInterfaceContext } from "@/components/contexts/InterfaceContext";
import DataTableComponent from "@/components/DataTable";
import { CardPropsClass } from "@/components/layout/CardWrapper";

/** Link state-level database rows to the corresponding Germany map feature. */
export default function CovidStateTable({ cardProps }: { cardProps: CardPropsClass }) {
  const context = useInterfaceContext();
  const selectedStateCode = stateMappersGermany.mapper__MapTable__ID_to_ID(context.selectedStateID);

  return (
    <DataTableComponent
      cardProps={cardProps}
      relationName={COVID_STATES_RELATION}
      targetDate={context.targetDate}
      rowKeyColumn="idbundesland"
      selectedRowColumn="idbundesland"
      selectedRowValue={selectedStateCode > 0 ? String(selectedStateCode).padStart(2, "0") : undefined}
      onClickEvent={(row) => {
        context.setTableRow(row);
        const mapId = getCovidStateMapId(row.original);
        if (mapId !== -1) context.setSelectedStateID(mapId);
      }}
    />
  );
}
