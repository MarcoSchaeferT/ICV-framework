"use client"
import DataTableComponent from '../../components/dataTable';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import FeedbackTable from '../../components/dataTableClasses/Feedback';


const FeedbackViewPage = () => {

  let feedbackTableProps =  new CardPropsClass("Table1","","","");

  return (
    <div>
      <div style={{ maxWidth: 800, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <DataTableComponent cardProps={feedbackTableProps}
          refDataTableClass={FeedbackTable} />
      </div>
    </div>
  );
};

export default FeedbackViewPage;