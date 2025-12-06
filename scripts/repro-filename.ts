
const formatCycleLabel = (start: string, end: string): string => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startMonth = months[startDate.getMonth()];
    const startDay = startDate.getDate();
    const endMonth = months[endDate.getMonth()];
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (startDate.getFullYear() === endDate.getFullYear()) {
        return `${startMonth} ${startDay} → ${endMonth} ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay}, ${startDate.getFullYear()} → ${endMonth} ${endDay}, ${year}`;
}

const label = formatCycleLabel('2025-10-08', '2025-11-08');
console.log('Label:', label);

const safeLabel = label.replace(/[^a-zA-Z0-9-]/g, '_');
console.log('Safe Label:', safeLabel);

const filename = `Reimbursement_for_Utlyze_${safeLabel}.csv`;
console.log('Filename:', filename);
