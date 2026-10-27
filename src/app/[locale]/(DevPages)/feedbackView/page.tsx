"use client"
import DataTableComponent from '@/components/DataTable';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import PageVisitStats from '@/components/PageVisitStats';
import { LoadingSpinnerProvider } from '@/components/plots/maps/utils/loadingSpinner';


/**
 * Renders the development-only feedback table and page-visit statistics.
 *
 * @returns The inspection view within a loading-task provider.
 */
const FeedbackViewPage = () => {

  let feedbackTableProps =  CardPropsClass("Table1","","","");

  return (
    <LoadingSpinnerProvider>
      <div>
        <div style={{ maxWidth: 800, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <DataTableComponent cardProps={feedbackTableProps} relationName="feedback_csv" />
        </div>
        <div style={{ maxWidth: 800, margin: '32px auto' }}>
          <PageVisitStats />
        </div>
      </div>
    </LoadingSpinnerProvider>
  );
};

/** Default export for the development feedback-record inspection page. */
export default FeedbackViewPage;
