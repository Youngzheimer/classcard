const axios = require('axios');
const qs = require('qs');
const fs = require('fs');

const TOKEN = '6728993 6a8276359f7a5c796a6ebabfb71caa0e';

function TS() {
    // return now as '20250901004130' like format
    const now = new Date();
    return now.toISOString().replace(/[-:.]/g, '').slice(0, 14);
}

function s_ts() {
    // return now as '2025-09-01 00:31:57' like format
    const now = new Date();
    return now.toISOString().replace(/[-:.]/g, ' ').slice(0, 19);
}

async function getClasses() {
  try {
    const response = await axios.post(
      'https://mobile.classcard.net/api/v2/sync/sync_set_class_v3',
      qs.stringify({
        req_data: JSON.stringify({
          p: JSON.stringify({
            base_info: {
              s_ts: s_ts(),
              user_idx: 6728993,
              g_class_full_sync: 0,
              set_log_full_sync: 0
            }
          })
        })
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Connection': 'keep-alive',
          'TS': TS(),
          'HMAC': '3d69971d467710d422a320ca41ae1f1c06f77e82879859ad086701d01a289993',
          'Accept': '*/*',
          'User-Agent': 'Class Card/1.0.486 (iPhone; iOS 18.6.1; Scale/3.0) Alamofire/4.9.1 u_idx:6728993 ccappinfo:ios-486',
          'Authorization': TOKEN,
          'Accept-Language': 'ko-KR,ko;q=0.9'
        },
        compress: true // --compressed에 해당
      }
    );

    return response.data?.res_data?.fm_class;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as { response?: { data?: any } };
      console.error('Error:', axiosError.response?.data || 'Unknown error');
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', String(error));
    }
    throw error;
  }
}

async function getClassSets() {
  try {
    const response = await axios.post(
      'https://mobile.classcard.net/api/v2/classes/sets_v4',
      qs.stringify({
        req_data: JSON.stringify({
          class_idx: 1590803
        })
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Connection': 'keep-alive',
          'TS': '20250901005022',
          'HMAC': '4e6b0ffe11214248ffdab7608c1e8ccfbfd6420d36dfea0669997a9c39d9d94c',
          'Accept': '*/*',
          'Authorization': TOKEN,
        },
        compress: true // --compressed에 해당
      }
    );

    return response.data?.res_data;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as { response?: { data?: any } };
      console.error('Error:', axiosError.response?.data || 'Unknown error');
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', String(error));
    }
    throw error;
  }
}

(async () => {
  const classSets = await getClassSets();
  console.log(classSets);
//   save to sets.json
    fs.writeFileSync('sets.json', JSON.stringify(classSets, null, 2));
    console.log('Data saved to sets.json');
})();